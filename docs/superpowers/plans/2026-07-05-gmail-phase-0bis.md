# Gmail Phase 0bis — Refactor envoi email (Resend only) + onglet trace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Factoriser tous les envois d'email client derrière `sendClientEmail()` (Resend uniquement), journaliser chaque tentative dans `email_logs` (y compris échecs et re-envois), fusionner le flux d'acompte dupliqué du webhook SignNow, et livrer l'onglet « Emails » (trace) sur la page événement. Zéro changement de transport : tout part toujours via Resend, comportement prod identique.

**Architecture:** Un nouveau module backend `client-email.ts` devient le point de passage unique envoi + journalisation. Le flux d'acompte (Stripe invoice + PDF + email + écritures) est extrait dans `deposit-flow.ts`, partagé entre la route `send-deposit` et le webhook SignNow. Côté front, une nouvelle feature `src/features/emails/` lit `email_logs` (RLS org ajoutée par migration) et affiche la trace dans un onglet de la page événement.

**Tech Stack:** Express 4 + TypeScript (backend), Supabase (service role côté backend, RLS côté front), Resend, Vite + React 19 + TanStack Query (front), Vitest (tests backend).

**Contexte spec :** `docs/superpowers/specs/2026-06-26-gmail-client-email-design.md`, section « Phase 0bis ». Cette phase est déployable seule et prépare la phase 1 (OAuth Gmail).

**Conventions du repo à respecter (extraits CLAUDE.md) :**
- Commits : une seule ligne courte en français, pas de body, pas de Co-Authored-By, pas d'emoji. Style `type(scope): sujet` en minuscules (voir `git log`).
- Commentaires : minimalistes, en français, seulement pour le non-évident.
- Pas de sur-ingénierie : pas de try/catch qui ne fait que re-raise, pas de fallback non demandé.
- Le repo n'utilise pas de mocks dans ses tests backend : tests purs ou tests statiques de source (voir `backend/tests/routes/webhook-switch.test.ts`). Le verrou de ce refactor suit ce style (Task 8).

**Note TDD :** le verrou de non-régression est un test statique de source qui ne peut passer qu'une fois TOUS les call sites migrés (Tasks 3–7). Il est donc écrit en Task 8, après les migrations, pour ne jamais committer de test rouge. Chaque task intermédiaire est vérifiée par `pnpm build` + `pnpm test` (suite existante).

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `supabase/migrations/20260705_email_logs_rls.sql` | Create | RLS org sur email_logs + backfill organization_id |
| `backend/src/lib/client-email.ts` | Create | `sendClientEmail()` (envoi Resend + log email_logs), helpers `getCommercialInfo` / `getOrgFacturationEmail` (déplacés de quotes.ts) |
| `backend/src/lib/deposit-flow.ts` | Create | `createAndSendDeposit()` : flux acompte complet partagé route/webhook + `quoteDepositTtc()` (déplacé de quotes.ts) |
| `backend/src/routes/quotes.ts` | Modify | send-email / send-deposit / send-balance passent par sendClientEmail ; helpers locaux supprimés |
| `backend/src/routes/webhooks.ts` | Modify | `autoSendDepositAfterSignature` réduit aux checks d'idempotence + appel `createAndSendDeposit` |
| `backend/src/routes/payments.ts` | Modify | create-link : email via sendClientEmail + helpers partagés |
| `backend/tests/routes/client-email-callsites.test.ts` | Create | Verrou statique : aucun appel Resend/insert email_logs direct dans les routes |
| `src/lib/supabase/types.ts` | Modify | Alias `EmailLog` (à côté de `ActivityLog`, ligne ~3288) |
| `src/features/emails/hooks/use-email-logs.ts` | Create | Hook React Query `useEmailLogsByBooking` |
| `src/features/emails/components/booking-emails-tab.tsx` | Create | Contenu de l'onglet Emails (liste trace) |
| `src/features/reservations/components/booking-detail-page.tsx` | Modify | TabsTrigger « Emails » + badge count |
| `src/features/reservations/components/booking-detail.tsx` | Modify | Bloc `{activeTab === 'emails' && ...}` |

---

### Task 1: Migration RLS + backfill sur email_logs

`email_logs` n'a aujourd'hui aucune RLS (créée par `20250309_integration_columns.sql` sans `ENABLE ROW LEVEL SECURITY`). Le front va la lire (onglet trace) et la supprime déjà (`use-bookings.ts:645`, `bookings-bulk-actions.tsx:74`), donc il faut SELECT + DELETE scopés org. Certaines lignes historiques ont `organization_id` NULL : backfill depuis le booking, sinon elles deviendraient invisibles/insupprimables côté front.

**Files:**
- Create: `supabase/migrations/20260705_email_logs_rls.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- RLS sur email_logs : lecture/suppression scopées organisation (le front lit
-- la trace des envois et supprime les logs a la suppression d'un booking).
-- Le backend ecrit via service role (bypass RLS).

-- Backfill des lignes historiques sans organization_id (sinon invisibles sous RLS)
UPDATE email_logs el
SET organization_id = b.organization_id
FROM bookings b
WHERE el.organization_id IS NULL
  AND el.booking_id = b.id;

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select_org" ON email_logs
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "email_logs_delete_org" ON email_logs
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "email_logs_service_role" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Vérifier qu'aucune migration existante ne porte le même nom**

Run: `ls supabase/migrations/ | grep 20260705`
Expected: seul `20260705_email_logs_rls.sql` apparaît.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260705_email_logs_rls.sql
git commit -m "feat(emails): rls org et backfill sur email_logs"
```

**Note déploiement (pour la checklist finale, Task 12) :** ce projet applique les migrations en les collant dans l'éditeur SQL de la prod Supabase (pas de CLI branchée). La migration doit être appliquée en prod AVANT de déployer le frontend de la Task 11.

---

### Task 2: Créer `backend/src/lib/client-email.ts`

Point de passage unique : envoi Resend + journalisation `email_logs` de chaque tentative (`sent`/`failed`). Un échec d'insert du log ne fait JAMAIS échouer un envoi réussi. On y déplace aussi `getCommercialInfo` et `getOrgFacturationEmail` (aujourd'hui privés dans `quotes.ts:85-119`, dupliqués inline dans `payments.ts` et `webhooks.ts`).

**Files:**
- Create: `backend/src/lib/client-email.ts`

- [ ] **Step 1: Écrire le module complet**

```typescript
import { sendEmail, SendEmailOptions } from './resend.js'
import { supabase } from './supabase.js'

// Helper partagé : email de facturation de l'organisation (reply-to secondaire)
export async function getOrgFacturationEmail(
  organizationId: string | null
): Promise<string | null> {
  if (!organizationId) return null
  const { data } = await supabase
    .from('organizations')
    .select('facturation_email')
    .eq('id', organizationId)
    .single()
  return (data as any)?.facturation_email || null
}

// Helper partagé : commercial assigné d'un booking (premier de assigned_user_ids)
export async function getCommercialInfo(
  bookingId: string
): Promise<{ name: string | null; email: string | null }> {
  const { data: bookingFull } = await supabase
    .from('bookings')
    .select('assigned_user_ids')
    .eq('id', bookingId)
    .single()

  const commercialId = (bookingFull as any)?.assigned_user_ids?.[0]
  if (commercialId) {
    const { data: user } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', commercialId)
      .single()
    if (user) {
      return { name: `${user.first_name} ${user.last_name}`, email: user.email }
    }
  }
  return { name: null, email: null }
}

export interface ClientEmailParams {
  organizationId: string | null
  bookingId?: string | null
  quoteId?: string | null
  emailType: string
  to: string
  subject: string
  html: string
  replyTo?: string
  facturationEmail?: string
  attachments?: SendEmailOptions['attachments']
}

// Point de passage unique des emails client : envoi Resend + journalisation
// email_logs de chaque tentative (sent/failed). Un échec d'insert ne doit
// jamais faire échouer un envoi réussi (best-effort).
export async function sendClientEmail(
  params: ClientEmailParams
): Promise<{ id: string }> {
  const logRow = {
    organization_id: params.organizationId,
    quote_id: params.quoteId || null,
    booking_id: params.bookingId || null,
    email_type: params.emailType,
    recipient_email: params.to,
    reply_to_email: params.replyTo || null,
    subject: params.subject,
  }

  try {
    const result = await sendEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
      facturationEmail: params.facturationEmail,
      attachments: params.attachments,
    })

    const { error } = await supabase.from('email_logs').insert({
      ...logRow,
      resend_message_id: result.id,
      status: 'sent',
    })
    if (error) console.error('[client-email] email_logs insert failed:', error)

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const { error } = await supabase.from('email_logs').insert({
      ...logRow,
      status: 'failed',
      error_message: message,
    })
    if (error) console.error('[client-email] email_logs insert failed:', error)
    throw err
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd backend && pnpm build`
Expected: exit 0, aucune erreur TypeScript.

- [ ] **Step 3: Vérifier la suite existante**

Run: `cd backend && pnpm test`
Expected: tous les tests existants passent (quote-rounding, credit-note, stripe-connect, webhook-switch).

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/client-email.ts
git commit -m "feat(emails): sendClientEmail centralise envoi resend et journalisation"
```

---

### Task 3: quotes.ts — send-email passe par sendClientEmail

**Files:**
- Modify: `backend/src/routes/quotes.ts` (imports lignes 39, 84-119 ; route send-email lignes 349-400)

- [ ] **Step 1: Remplacer les helpers locaux par des imports**

Dans `backend/src/routes/quotes.ts` :

1. GARDER pour l'instant la ligne 39 `import { sendEmail } from '../lib/resend.js'` (encore utilisée par les branches renvoi et le solde jusqu'aux Tasks 4-5 ; elle est supprimée en Task 5). À cette étape, ajouter seulement le nouvel import après la ligne 52 (`import { savePdfAsDocument }...`) :

```typescript
import {
  sendClientEmail,
  getCommercialInfo,
  getOrgFacturationEmail,
} from '../lib/client-email.js'
```

2. Supprimer les deux définitions locales `getOrgFacturationEmail` (lignes 84-95) et `getCommercialInfo` (lignes 97-119) — les appels existants dans tout le fichier utilisent désormais les versions importées (mêmes signatures, aucun autre changement).

- [ ] **Step 2: Remplacer l'envoi + le log dans send-email**

Dans la route `POST /:id/send-email`, remplacer le bloc `sendEmail` (lignes ~349-361) :

```typescript
    // Send via Resend
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })
```

par :

```typescript
    // Send via Resend (journalisé par sendClientEmail)
    const emailResult = await sendClientEmail({
      organizationId: quoteData.organization_id,
      bookingId: booking?.id || null,
      quoteId,
      emailType: 'quote_sent',
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })
```

puis supprimer entièrement le bloc « Log email » en fin de route (lignes ~389-400) :

```typescript
    // Log email
    await supabase.from('email_logs').insert({
      organization_id: quoteData.organization_id,
      quote_id: quoteId,
      booking_id: booking?.id,
      email_type: 'quote_sent',
      recipient_email: contact.email,
      reply_to_email: commercialEmail || restaurant?.email,
      subject,
      resend_message_id: emailResult.id,
      status: 'sent',
    })
```

(La variable `emailResult` reste utilisée par la réponse `res.json({ success: true, emailId: emailResult.id })` — ne pas la supprimer.)

- [ ] **Step 3: Compiler et tester**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0, tests verts.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/quotes.ts
git commit -m "refactor(devis): send-email passe par sendClientEmail"
```

---

### Task 4: quotes.ts — solde (principal + renvoi) et renvoi d'acompte journalisés

Les branches re-envoi (acompte ligne ~592, solde ligne ~981) n'écrivent aujourd'hui AUCUN log : c'est le trou principal de la trace. On les type `deposit_invoice_resend` / `balance_invoice_resend` pour les distinguer dans l'onglet.

**Files:**
- Modify: `backend/src/routes/quotes.ts` (branche re-envoi deposit ~592, branche re-envoi balance ~981, envoi principal balance ~1134-1146 + log ~1221-1232)

- [ ] **Step 1: Branche re-envoi acompte**

Dans `POST /:id/send-deposit`, branche « Reuse the existing Stripe invoice », remplacer :

```typescript
          await sendEmail({
            to: contact.email,
            subject,
            html,
            replyTo: commercial.email || restaurant?.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })
```

par :

```typescript
          await sendClientEmail({
            organizationId: quoteData.organization_id,
            bookingId: booking?.id || null,
            quoteId,
            emailType: 'deposit_invoice_resend',
            to: contact.email,
            subject,
            html,
            replyTo: commercial.email || restaurant?.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })
```

- [ ] **Step 2: Branche re-envoi solde**

Dans `POST /:id/send-balance`, branche « Reusing existing Stripe balance invoice », remplacer le `await sendEmail({...})` (ligne ~981, même forme que ci-dessus) par :

```typescript
          await sendClientEmail({
            organizationId: quoteData.organization_id,
            bookingId: booking?.id || null,
            quoteId,
            emailType: 'balance_invoice_resend',
            to: contact.email,
            subject,
            html,
            replyTo: commercial.email || restaurant?.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })
```

- [ ] **Step 3: Envoi principal du solde**

Toujours dans send-balance, remplacer le bloc principal (lignes ~1134-1146) :

```typescript
    // Send email
    const emailResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `facture-solde-${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })
```

par :

```typescript
    // Send email (journalisé par sendClientEmail)
    await sendClientEmail({
      organizationId: quoteData.organization_id,
      bookingId: booking?.id || null,
      quoteId,
      emailType: 'balance_invoice',
      to: contact.email,
      subject,
      html,
      replyTo: commercialEmail || restaurant?.email || undefined,
      facturationEmail: facturationEmail || undefined,
      attachments: [
        {
          filename: `facture-solde-${quoteData.quote_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })
```

puis supprimer le bloc « Log email » de send-balance (lignes ~1221-1232, insert `email_type: 'balance_invoice'`). Attention : `emailResult` n'est PAS utilisé ailleurs dans send-balance (la réponse renvoie `sessionId`/`paymentUrl`) — la variable disparaît avec ce remplacement.

- [ ] **Step 4: Compiler, tester, committer**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0, tests verts.

```bash
git add backend/src/routes/quotes.ts
git commit -m "refactor(devis): solde et renvois journalises via sendClientEmail"
```

---

### Task 5: Extraire le flux d'acompte dans `backend/src/lib/deposit-flow.ts`

Le chemin principal de `send-deposit` (quotes.ts lignes ~613-856) devient `createAndSendDeposit()`, réutilisé par le webhook en Task 6. `quoteDepositTtc` (quotes.ts lignes 26-38) déménage ici car l'acompte est son domaine ; send-balance continue de l'importer pour garantir acompte + solde = total.

**Files:**
- Create: `backend/src/lib/deposit-flow.ts`
- Modify: `backend/src/routes/quotes.ts` (suppression de quoteDepositTtc local + corps du chemin principal send-deposit)

- [ ] **Step 1: Écrire deposit-flow.ts**

```typescript
import Stripe from 'stripe'
import {
  buildDepositEmailHtml,
  buildDepositEmailSubject,
} from './email-templates.js'
import { generateQuotePdf, fetchQuoteFullData } from './pdf-generator.js'
import { computeDepositAmounts, formatEuroAdaptive } from './quote-rounding.js'
import {
  getRestaurantStripeContext,
  resolveStripeMode,
  stripeRequestOptions,
  getOrCreateStripeCustomerOnAccount,
} from './stripe-connect.js'
import { supabase } from './supabase.js'
import { savePdfAsDocument } from './documents.js'
import {
  sendClientEmail,
  getCommercialInfo,
  getOrgFacturationEmail,
} from './client-email.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

// Montant d'acompte TTC : montant fixe saisi (override) sinon pourcentage, au centime.
// Acompte et solde DOIVENT passer par cet helper pour que acompte + solde = total exactement.
export function quoteDepositTtc(q: {
  total_ttc: number
  total_ht?: number | null
  deposit_amount_override?: number | null
  deposit_percentage?: number | null
}): number {
  return computeDepositAmounts(q.total_ttc, q.total_ht ?? 0, {
    overrideTtc: q.deposit_amount_override ?? null,
    percentage: q.deposit_percentage ?? null,
  }).ttc
}

export interface DepositSendResult {
  invoiceId: string
  invoiceUrl: string
  depositAmount: number
}

// Flux complet d'envoi d'acompte : facture Stripe Connect (ou fallback virement),
// PDF, email, écritures quotes/payment_links/payments/activity_logs.
// Partagé entre la route send-deposit (source 'manual') et le webhook SignNow
// (source 'auto_signature'). quoteData optionnel pour éviter un double fetch.
export async function createAndSendDeposit(
  quoteId: string,
  opts: {
    source: 'manual' | 'auto_signature'
    actorUserId?: string | null
    quoteData?: any
  }
): Promise<DepositSendResult> {
  const quoteData = opts.quoteData ?? (await fetchQuoteFullData(quoteId))
  const booking = quoteData.booking
  const restaurant = booking?.restaurant
  const contact = booking?.contact

  if (!contact?.email) {
    throw new Error("Le contact n'a pas d'adresse email")
  }

  const isAuto = opts.source === 'auto_signature'

  // Montant fixe en priorité, sinon % du TTC — toujours via le helper partagé.
  const depositAmount = quoteDepositTtc(quoteData)
  const effectiveDepositPct =
    quoteData.deposit_amount_override != null
      ? Math.round((depositAmount / quoteData.total_ttc) * 100)
      : quoteData.deposit_percentage

  const commercial = booking
    ? await getCommercialInfo(booking.id)
    : { name: null, email: null }

  // Connect-only : on encaisse Stripe UNIQUEMENT sur le compte Connect du
  // restaurant. Sinon → fallback virement bancaire (aucune facture plateforme).
  const restaurantId = (restaurant as any)?.id as string | undefined
  const stripeCtx = restaurantId
    ? await getRestaurantStripeContext(restaurantId)
    : null
  const stripeMode = stripeCtx
    ? resolveStripeMode(stripeCtx)
    : ({ mode: 'bank_transfer', reason: 'disabled' } as const)

  const isStripeEnabled = stripeMode.mode === 'connect'
  const connectAcctId = stripeMode.mode === 'connect' ? stripeMode.acctId : null
  const stripeOpts = stripeRequestOptions(connectAcctId)

  let invoiceUrl = ''
  let invoiceId = ''

  if (isStripeEnabled && connectAcctId) {
    console.log(
      `[deposit-flow] Creating Stripe invoice on Connect account ${connectAcctId} for deposit: ${formatEuroAdaptive(depositAmount)}`
    )

    const customerId = await getOrCreateStripeCustomerOnAccount(
      contact.email,
      `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null,
      connectAcctId
    )

    const invoice = await stripe.invoices.create(
      {
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: 30,
        metadata: {
          booking_id: booking?.id || '',
          quote_id: quoteId,
          link_type: 'deposit',
          restaurant_id: restaurantId || '',
        },
        description:
          quoteData.deposit_amount_override != null
            ? `Acompte ${formatEuroAdaptive(depositAmount)} - ${quoteData.quote_number}`
            : `Acompte ${effectiveDepositPct}% - ${quoteData.quote_number}`,
      },
      stripeOpts
    )

    // Stripe est appelé en cents : depositAmount est entier, donc × 100 = entier exact.
    await stripe.invoiceItems.create(
      {
        invoice: invoice.id,
        customer: customerId,
        amount: Math.round(depositAmount * 100),
        currency: 'eur',
        description:
          quoteData.deposit_amount_override != null
            ? `Acompte ${formatEuroAdaptive(depositAmount)} pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`
            : `Acompte ${effectiveDepositPct}% pour ${restaurant?.name || 'événement'} le ${quoteData.date_start || booking?.event_date || ''}`,
      },
      stripeOpts
    )

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      invoice.id,
      undefined,
      stripeOpts
    )
    invoiceUrl = finalizedInvoice.hosted_invoice_url || ''
    invoiceId = invoice.id
  } else {
    const reason =
      stripeMode.mode === 'bank_transfer' ? stripeMode.reason : 'unknown'
    console.log(
      `[deposit-flow] No Stripe Connect (reason=${reason}) — bank transfer fallback for ${formatEuroAdaptive(depositAmount)}`
    )
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateQuotePdf(quoteId, 'acompte', quoteData)
  } catch (pdfError) {
    console.error('[deposit-flow] Error generating deposit PDF:', pdfError)
    throw new Error("Erreur lors de la génération du PDF d'acompte")
  }

  const html = buildDepositEmailHtml({
    restaurant: restaurant as any,
    contact: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
    },
    quoteNumber: quoteData.quote_number,
    depositPercentage: effectiveDepositPct,
    depositAmount,
    totalTtc: quoteData.total_ttc,
    stripePaymentUrl: invoiceUrl,
    eventDate: quoteData.date_start || booking?.event_date || null,
    commercialName: commercial.name,
    stripeEnabled: isStripeEnabled,
    orderNumber: quoteData.order_number,
  })

  const subject = buildDepositEmailSubject(
    quoteData.quote_number,
    restaurant?.name || 'Restaurant'
  )

  const facturationEmail = await getOrgFacturationEmail(
    quoteData.organization_id
  )

  await sendClientEmail({
    organizationId: quoteData.organization_id,
    bookingId: booking?.id || null,
    quoteId,
    emailType: 'deposit_invoice',
    to: contact.email,
    subject,
    html,
    replyTo: commercial.email || restaurant?.email || undefined,
    facturationEmail: facturationEmail || undefined,
    attachments: [
      {
        filename: `facture-acompte-${quoteData.quote_number}.pdf`,
        content: pdfBuffer,
      },
    ],
  })

  await savePdfAsDocument(
    pdfBuffer,
    `facture-acompte-${quoteData.quote_number}.pdf`,
    `${quoteData.organization_id}/quotes/${quoteId}/facture-acompte-${quoteData.quote_number}.pdf`,
    `Facture acompte - ${quoteData.quote_number}`,
    quoteData.organization_id,
    booking?.id || null
  )

  await supabase
    .from('quotes')
    .update({
      status: 'deposit_sent',
      deposit_sent_at: new Date().toISOString(),
      ...(isStripeEnabled
        ? {
            stripe_deposit_session_id: invoiceId,
            stripe_deposit_url: invoiceUrl,
          }
        : {}),
    })
    .eq('id', quoteId)

  if (isStripeEnabled) {
    await supabase.from('payment_links').insert({
      booking_id: booking?.id,
      quote_id: quoteId,
      link_type: 'deposit',
      amount: depositAmount,
      percentage: quoteData.deposit_percentage,
      url: invoiceUrl,
      stripe_link_id: invoiceId,
      stripe_account_id: connectAcctId,
    })

    await supabase.from('payments').insert({
      organization_id: quoteData.organization_id,
      booking_id: booking?.id,
      quote_id: quoteId,
      amount: depositAmount,
      payment_type: 'deposit',
      payment_modality: 'acompte',
      payment_method: 'stripe',
      stripe_payment_id: invoiceId,
      stripe_account_id: connectAcctId,
      status: 'pending',
      notes: `Acompte ${quoteData.deposit_percentage}% - ${quoteData.quote_number}`,
    })
  } else {
    await supabase.from('payments').insert({
      organization_id: quoteData.organization_id,
      booking_id: booking?.id,
      quote_id: quoteId,
      amount: depositAmount,
      payment_type: 'deposit',
      payment_modality: 'acompte',
      payment_method: 'virement',
      status: 'pending',
      notes: `Acompte ${quoteData.deposit_percentage}% - ${quoteData.quote_number} (virement bancaire)`,
    })
  }

  await supabase.from('activity_logs').insert({
    organization_id: quoteData.organization_id,
    booking_id: booking?.id,
    action_type: 'payment.deposit_sent',
    action_label: `Facture acompte de ${depositAmount.toLocaleString('fr-FR')} € envoyée${
      isAuto
        ? ` automatiquement après signature${isStripeEnabled ? '' : ' (virement bancaire)'}`
        : isStripeEnabled
          ? ' avec lien de paiement'
          : ' (virement bancaire)'
    }`,
    actor_type: isAuto ? 'system' : 'user',
    ...(isAuto
      ? { actor_name: 'Système' }
      : { actor_id: opts.actorUserId || null }),
    entity_type: 'quote',
    entity_id: quoteId,
    metadata: {
      amount: depositAmount,
      method: isStripeEnabled ? 'stripe' : 'virement',
      ...(isAuto ? { auto: true } : {}),
    },
  })

  return { invoiceId, invoiceUrl, depositAmount }
}
```

- [ ] **Step 2: Brancher quotes.ts dessus**

Dans `backend/src/routes/quotes.ts` :

1. Supprimer la définition locale `quoteDepositTtc` (lignes 26-38, entre les deux blocs d'import) et ajouter l'import :

```typescript
import { createAndSendDeposit, quoteDepositTtc } from '../lib/deposit-flow.js'
```

(`quoteDepositTtc` reste utilisé par la branche re-envoi acompte et par send-balance — rien d'autre à changer pour ces usages.)

Supprimer aussi la ligne `import { sendEmail } from '../lib/resend.js'` : après cette task, plus aucun envoi de quotes.ts ne l'utilise (condition du verrou Task 8). Si `computeDepositAmounts` n'a plus d'usage dans quotes.ts après la suppression de `quoteDepositTtc`, retirer aussi cet import (laisser `pnpm build`/`pnpm lint` trancher).

2. Dans `POST /:id/send-deposit`, remplacer TOUT le chemin principal après la branche re-envoi — c'est-à-dire depuis le commentaire `// Calculate deposit amount` (ligne ~613) jusqu'au `res.json({ success: true, sessionId: ..., paymentUrl: ... })` inclus (ligne ~865) — par :

```typescript
    const result = await createAndSendDeposit(quoteId, {
      source: 'manual',
      actorUserId: req.body.userId || null,
      quoteData,
    })

    console.log(
      `[send-deposit] ✅ Deposit for quote ${quoteData.quote_number} sent to ${contact.email}, amount: ${result.depositAmount}€`
    )
    res.json({
      success: true,
      sessionId: result.invoiceId || null,
      paymentUrl: result.invoiceUrl || null,
    })
```

Le `catch` de la route reste inchangé (500 générique). Changement de comportement assumé et volontaire : l'échec PDF renvoie désormais le message générique `Failed to send deposit invoice` au lieu du message PDF spécifique (le détail reste dans les logs serveur).

- [ ] **Step 3: Compiler, tester, committer**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0, tests verts.

```bash
git add backend/src/lib/deposit-flow.ts backend/src/routes/quotes.ts
git commit -m "refactor(acompte): flux d'envoi partage dans deposit-flow"
```

---

### Task 6: webhooks.ts — l'auto-envoi post-signature réutilise deposit-flow

`autoSendDepositAfterSignature` (webhooks.ts lignes 1075-1432) duplique intégralement le flux send-deposit. On le réduit aux garde-fous d'idempotence + un appel `createAndSendDeposit`. Corrections volontaires embarquées (divergences du doublon actuel) : l'email auto gère désormais `deposit_amount_override` et inclut `orderNumber`, et le PDF passe par `savePdfAsDocument` au lieu du code storage inline.

**Files:**
- Modify: `backend/src/routes/webhooks.ts` (fonction complète lignes 1075-1432 + imports)

- [ ] **Step 1: Remplacer la fonction**

Remplacer TOUTE la fonction `autoSendDepositAfterSignature` par :

```typescript
async function autoSendDepositAfterSignature(quoteId: string) {
  try {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, status, quote_number')
      .eq('id', quoteId)
      .single()

    if (!quote) return

    // Idempotency: skip if deposit was already sent or a pending deposit payment exists
    if (quote.status === 'deposit_sent' || quote.status === 'deposit_paid') {
      console.log(
        `[SignNow] Quote ${quote.quote_number} already has status ${quote.status} — skipping auto-deposit`
      )
      return
    }

    const { data: existingDeposit } = await supabase
      .from('payments')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('payment_type', 'deposit')
      .in('status', ['pending', 'paid'])
      .maybeSingle()

    if (existingDeposit) {
      console.log(
        `[SignNow] Deposit payment already exists for quote ${quoteId} — skipping auto-deposit`
      )
      return
    }

    await createAndSendDeposit(quoteId, { source: 'auto_signature' })

    console.log(
      `✅ Auto-sent deposit email for quote ${quote.quote_number} after signature`
    )
  } catch (error: any) {
    console.error(
      '❌ Error auto-sending deposit after signature:',
      error?.message || error
    )
    throw error
  }
}
```

- [ ] **Step 2: Nettoyer les imports de webhooks.ts**

Ajouter :

```typescript
import { createAndSendDeposit } from '../lib/deposit-flow.js'
```

Supprimer les imports devenus inutilisés par ce remplacement — vérifier chacun avec une recherche dans le fichier avant suppression (certains servent ailleurs dans webhooks.ts) :
- `sendEmail` de `'../lib/resend.js'` (ligne 13) — à supprimer si plus aucun usage ;
- `generateQuotePdf` de `'../lib/pdf-generator.js'` (ligne 11) — idem ;
- `computeDepositAmounts` de `'../lib/quote-rounding.js'` (ligne 12) — idem ;
- `buildDepositEmailHtml` / `buildDepositEmailSubject` de `'../lib/email-templates.js'` — idem (garder les autres templates utilisés) ;
- helpers `'../lib/stripe-connect.js'` — ATTENTION : probablement utilisés par les handlers Stripe, ne supprimer que ce qui n'a plus d'usage.

`pnpm build` + `pnpm lint` signalent les imports morts restants.

- [ ] **Step 3: Compiler, tester, committer**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0 ; `webhook-switch.test.ts` reste vert (les `case` Stripe ne sont pas touchés).

```bash
git add backend/src/routes/webhooks.ts
git commit -m "refactor(acompte): l'auto-envoi post-signature reutilise deposit-flow"
```

---

### Task 7: payments.ts — create-link journalisé via sendClientEmail

Aujourd'hui l'email du lien de paiement n'écrit aucun `email_logs` et duplique inline la résolution commercial/facturation (lignes 282-308).

**Files:**
- Modify: `backend/src/routes/payments.ts` (imports + bloc email lignes ~274-347)

- [ ] **Step 1: Imports**

Remplacer `import { sendEmail } from '../lib/resend.js'` par :

```typescript
import {
  sendClientEmail,
  getCommercialInfo,
  getOrgFacturationEmail,
} from '../lib/client-email.js'
```

- [ ] **Step 2: Remplacer le bloc email de create-link**

Dans `POST /create-link`, remplacer l'intérieur du `try` du bloc `if (send_email)` (résolution commercial inline lignes ~283-297, facturation inline lignes ~299-308, `sendEmail` lignes ~332-338) par :

```typescript
          // Commercial info (for reply-to + signature)
          const commercial = await getCommercialInfo(booking_id)

          // Org-level facturation email (for reply-to)
          const facturationEmail = await getOrgFacturationEmail(
            bookingAny.organization_id
          )

          const html = buildPaymentLinkEmailHtml({
            restaurant: restaurantBranding,
            contact: {
              first_name: contactFromDb?.first_name || '',
              last_name: contactFromDb?.last_name || null,
              email: toEmail,
            },
            quoteNumber,
            modality,
            amount,
            stripePaymentUrl: paymentLink.url,
            eventDate: bookingAny.event_date || null,
            commercialName: commercial.name,
            orderNumber: quoteOrderNumber,
          })

          const subject = buildPaymentLinkEmailSubject(
            modality,
            restaurantBranding.name || 'Restaurant',
            quoteNumber
          )

          await sendClientEmail({
            organizationId: bookingAny.organization_id,
            bookingId: booking_id,
            quoteId: quote_id || null,
            emailType: 'payment_link',
            to: toEmail,
            subject,
            html,
            replyTo: commercial.email || restaurantBranding.email || undefined,
            facturationEmail: facturationEmail || undefined,
          })

          emailSent = true
          console.log(`[create-link] ✅ Email sent to ${toEmail}`)
```

(Le `catch (err)` existant qui alimente `emailError` reste inchangé.)

- [ ] **Step 3: Compiler, tester, committer**

Run: `cd backend && pnpm build && pnpm test`
Expected: exit 0, tests verts.

```bash
git add backend/src/routes/payments.ts
git commit -m "refactor(paiements): lien de paiement journalise via sendClientEmail"
```

---

### Task 8: Verrou statique des call sites

Style du repo (`webhook-switch.test.ts`) : lecture statique des sources, pas d'exécution. Garantit qu'aucune route client ne recommence à appeler Resend ou `email_logs` en direct.

**Files:**
- Create: `backend/tests/routes/client-email-callsites.test.ts`

- [ ] **Step 1: Écrire le test**

```typescript
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Garde-fou du refactor phase 0bis (spec gmail du 26/06) : tous les emails
// CLIENT passent par sendClientEmail (envoi + journalisation email_logs).
// Un appel direct à sendEmail ou un insert email_logs dans une route recrée
// un envoi non tracé. Les emails internes (invitations members.ts,
// notifications commerciales) restent volontairement sur sendEmail.

const read = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../src', p), 'utf-8')

const clientRoutes = ['routes/quotes.ts', 'routes/webhooks.ts', 'routes/payments.ts']

describe('client emails go through sendClientEmail', () => {
  clientRoutes.forEach((file) => {
    it(`${file} does not import sendEmail from resend directly`, () => {
      expect(read(file)).not.toContain("from '../lib/resend.js'")
    })

    it(`${file} does not write email_logs directly`, () => {
      expect(read(file)).not.toContain("from('email_logs').insert")
    })
  })

  it('client-email.ts is the only email_logs writer in src/lib', () => {
    const libDir = path.resolve(__dirname, '../../src/lib')
    const writers = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) =>
        fs
          .readFileSync(path.join(libDir, f), 'utf-8')
          .includes("from('email_logs').insert")
      )
    expect(writers).toEqual(['client-email.ts'])
  })
})
```

- [ ] **Step 2: Vérifier qu'il passe**

Run: `cd backend && pnpm test`
Expected: tous verts, y compris le nouveau fichier. S'il échoue, un call site des Tasks 3-7 a été oublié — le corriger avant de committer.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/client-email-callsites.test.ts
git commit -m "test(emails): verrou des call sites sendClientEmail"
```

---

### Task 9: Type EmailLog + hook front use-email-logs

**Files:**
- Modify: `src/lib/supabase/types.ts` (à côté de `export type ActivityLog = Tables<'activity_logs'>`, ligne ~3288)
- Create: `src/features/emails/hooks/use-email-logs.ts`

- [ ] **Step 1: Alias de type**

Dans `src/lib/supabase/types.ts`, juste après la ligne `export type ActivityLog = Tables<'activity_logs'>` :

```typescript
export type EmailLog = Tables<'email_logs'>
```

(La section d'alias manuels en fin de fichier généré est le pattern existant — ne rien toucher d'autre dans ce fichier.)

- [ ] **Step 2: Hook**

Créer `src/features/emails/hooks/use-email-logs.ts` (même pattern que `useActivityLogs` dans `src/features/reservations/hooks/use-activity-logs.ts:150-164`) :

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EmailLog } from '@/lib/supabase/types'

export function useEmailLogsByBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ['email_logs', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('email_logs') as any)
        .select('*')
        .eq('booking_id', bookingId!)
        .order('sent_at', { ascending: false })

      if (error) throw error
      return data as EmailLog[]
    },
  })
}
```

- [ ] **Step 3: Compiler**

Run: `pnpm build` (à la racine)
Expected: tsc + vite build sans erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/types.ts src/features/emails/hooks/use-email-logs.ts
git commit -m "feat(emails): hook et type email_logs cote front"
```

---

### Task 10: Composant BookingEmailsTab

Liste de trace, même vocabulaire visuel que l'onglet Historique (Card, Badge, état vide, loader).

**Files:**
- Create: `src/features/emails/components/booking-emails-tab.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
import { Loader2, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useEmailLogsByBooking } from '../hooks/use-email-logs'

const EMAIL_TYPE_LABELS: Record<string, string> = {
  quote_sent: 'Devis',
  deposit_invoice: "Facture d'acompte",
  deposit_invoice_resend: "Facture d'acompte (renvoi)",
  balance_invoice: 'Facture de solde',
  balance_invoice_resend: 'Facture de solde (renvoi)',
  payment_link: 'Lien de paiement',
}

export function BookingEmailsTab({ bookingId }: { bookingId: string }) {
  const { data: logs = [], isLoading } = useEmailLogsByBooking(bookingId)

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Emails envoyés</h3>
        <Badge variant='secondary'>
          {logs.length} email{logs.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className='py-8 text-center text-muted-foreground'>
            <Mail className='mx-auto mb-2 h-8 w-8 opacity-50' />
            <p className='text-sm'>Aucun email envoyé.</p>
            <p className='mt-1 text-xs'>
              Les devis et factures envoyés au client apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='divide-y py-2'>
            {logs.map((log) => (
              <div key={log.id} className='flex items-start gap-3 py-3'>
                <Mail className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium'>
                      {EMAIL_TYPE_LABELS[log.email_type] || log.email_type}
                    </span>
                    {log.status === 'failed' ? (
                      <Badge
                        variant='destructive'
                        className='h-5 px-1.5 text-[10px]'
                      >
                        Échec
                      </Badge>
                    ) : (
                      <Badge
                        variant='secondary'
                        className='h-5 px-1.5 text-[10px]'
                      >
                        Envoyé
                      </Badge>
                    )}
                  </div>
                  {log.subject && (
                    <p className='truncate text-sm text-muted-foreground'>
                      {log.subject}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    À {log.recipient_email}
                    {log.sent_at &&
                      ` · ${new Date(log.sent_at).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}`}
                  </p>
                  {log.status === 'failed' && log.error_message && (
                    <p className='mt-1 text-xs text-destructive'>
                      {log.error_message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Compiler**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/emails/components/booking-emails-tab.tsx
git commit -m "feat(emails): composant trace des emails d'un evenement"
```

---

### Task 11: Brancher l'onglet Emails sur la page événement

**Files:**
- Modify: `src/features/reservations/components/booking-detail-page.tsx` (imports, hooks ligne ~53, TabsList lignes 137-192)
- Modify: `src/features/reservations/components/booking-detail.tsx` (import + bloc avant `activeTab === 'historique'` ligne ~3160)

- [ ] **Step 1: Trigger + badge dans booking-detail-page.tsx**

1. Ajouter `Mail` à l'import lucide-react (ligne 3-13).
2. Ajouter l'import du hook après les imports de hooks existants (~ligne 39) :

```typescript
import { useEmailLogsByBooking } from '@/features/emails/hooks/use-email-logs'
```

3. Ajouter après `const { data: menuForms = [] } = useBookingMenuForms(id)` (ligne ~53) :

```typescript
  const { data: emailLogs = [] } = useEmailLogsByBooking(id)
```

4. Passer la TabsList de `grid-cols-6` à `grid-cols-7` (ligne 137) et insérer ce trigger entre `fiche-fonction` et `historique` :

```tsx
              <TabsTrigger value='emails' className='gap-1.5'>
                <Mail className='h-4 w-4' />
                Emails
                {emailLogs.length > 0 && (
                  <Badge
                    variant='secondary'
                    className='ml-1 h-5 px-1.5 text-[10px]'
                  >
                    {emailLogs.length}
                  </Badge>
                )}
              </TabsTrigger>
```

- [ ] **Step 2: Bloc de contenu dans booking-detail.tsx**

1. Ajouter l'import (zone d'imports de composants en tête de fichier) :

```typescript
import { BookingEmailsTab } from '@/features/emails/components/booking-emails-tab'
```

2. Insérer juste AVANT le bloc `{/* ── Tab: Historique ── */}` (ligne ~3160) :

```tsx
              {/* ── Tab: Emails ── */}
              {activeTab === 'emails' && (
                <BookingEmailsTab bookingId={booking.id} />
              )}
```

- [ ] **Step 3: Compiler + lint**

Run: `pnpm build && pnpm lint`
Expected: exit 0 pour les deux.

- [ ] **Step 4: Vérification manuelle rapide**

Lancer `pnpm dev`, ouvrir un événement ayant déjà des devis envoyés → l'onglet « Emails » affiche les lignes historiques (`quote_sent`, `deposit_invoice`, ...) avec badge de count. NOTE : en local, la lecture ne marche que si la migration Task 1 est appliquée sur la base utilisée par le front — sinon RLS absente = lecture OK aussi ; le cas à vérifier surtout : l'onglet s'affiche et la liste se charge sans erreur console.

- [ ] **Step 5: Commit**

```bash
git add src/features/reservations/components/booking-detail-page.tsx src/features/reservations/components/booking-detail.tsx
git commit -m "feat(emails): onglet emails sur la page evenement"
```

---

### Task 12: Vérifications finales + checklist de déploiement

- [ ] **Step 1: Suites complètes**

Run: `cd backend && pnpm build && pnpm test && pnpm lint`
Expected: exit 0 partout, le verrou client-email-callsites vert.

Run (racine): `pnpm build && pnpm lint`
Expected: exit 0.

- [ ] **Step 2: Revue du diff complet**

Run: `git log --oneline main@{u}..HEAD 2>/dev/null || git log --oneline -12`
Vérifier : ~10 commits, une ligne chacun, en français, sans body.

Run: `git diff main@{u}..HEAD --stat 2>/dev/null || git show --stat HEAD`
Vérifier qu'aucun fichier hors périmètre n'est touché (notamment : pas de reformatage massif de quotes.ts/webhooks.ts).

- [ ] **Step 3: Checklist de déploiement (à exécuter par Thomas, dans cet ordre)**

1. Appliquer `supabase/migrations/20260705_email_logs_rls.sql` dans l'éditeur SQL Supabase prod.
2. Déployer le backend (aucun changement de comportement d'envoi : tout reste Resend, mêmes templates, mêmes destinataires ; s'ajoutent les logs des renvois/liens et le statut `failed`).
3. Déployer le frontend (l'onglet Emails apparaît).
4. Smoke test prod : envoyer un devis de test → vérifier la ligne dans l'onglet Emails ; re-envoyer un acompte existant → vérifier la ligne `deposit_invoice_resend`.

---

## Comportements volontairement modifiés (à connaître en review)

1. Les renvois acompte/solde et le lien de paiement écrivent désormais `email_logs` (types `deposit_invoice_resend`, `balance_invoice_resend`, `payment_link`) — avant : aucune trace.
2. Les échecs Resend écrivent `email_logs.status = 'failed'` + `error_message` — avant : aucune trace d'échec.
3. L'email d'acompte auto post-signature gère `deposit_amount_override` et inclut `orderNumber` (alignement sur send-deposit ; le doublon supprimé les ignorait).
4. L'échec de génération PDF dans send-deposit renvoie le message 500 générique au lieu du message PDF spécifique.
5. `email_logs` passe sous RLS (SELECT/DELETE org + service_role) — les écritures backend (service role) ne changent pas.

## Hors périmètre (phases suivantes du spec)

Pas de Gmail, pas d'OAuth, pas de tables `email_threads`/`email_messages`, pas de composer, pas d'envoi avoir/relance : phase 1 et suivantes. Le bouton relance `/api/payments/:id/remind` continue de ne pas envoyer d'email (phase 2).
