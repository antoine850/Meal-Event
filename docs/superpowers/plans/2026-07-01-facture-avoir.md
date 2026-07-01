# Facture d'avoir — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "facture d'avoir" (credit note) feature: from a devis, credit selected prestations, reduce the quote (and its balance invoice), and emit an immutable, numbered avoir document.

**Architecture:** Pure calc helpers (isomorphic frontend/backend) compute the avoir as `old effective total − new effective total`. A backend endpoint applies the change atomically via a Postgres function (freeze acompte, reduce lines, insert `credit_notes` + items, bump an atomic counter). A new `avoir` PDF type renders the document. Frontend adds a selection dialog, a hook, an "Avoirs" sub-card, and a Fichiers type badge.

**Tech Stack:** TypeScript, React 19, Express 4, Supabase (Postgres + RLS), vitest (backend), pdfmake.

**Spec:** `docs/superpowers/specs/2026-07-01-facture-avoir-design.md`

**Test reality:** backend uses vitest (`backend/tests/*.test.ts`); frontend has no test runner. Pure calc logic is TDD'd in vitest; DB/endpoint/PDF/UI are verified with `pnpm build`, `pnpm lint`, and the preview server.

---

## Phase 1 — Calc core (isomorphic, TDD)

New pure helpers in **both** copies of `quote-rounding.ts`. Backend first (tested), then mirror to frontend byte-for-byte.

### Task 1: `computeEffectiveTotals` + `applyLineCredit` + `computeCreditNote` (backend)

**Files:**
- Modify: `backend/src/lib/quote-rounding.ts` (append after `computeBalanceTtc`, line 198)
- Test: `backend/tests/credit-note.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/credit-note.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeEffectiveTotals,
  applyLineCredit,
  computeCreditNote,
  computeLineAmounts,
} from '../src/lib/quote-rounding'

// Produits + un extra. Les extras sont hors quotes.total_ttc mais dans le total effectif.
const ITEMS = [
  { id: 'p1', quantity: 1, unit_price_ttc: 1000, price_entry_mode: 'ttc' as const, tva_rate: 20, item_type: 'product' },
  { id: 'p2', quantity: 1, unit_price_ttc: 200, price_entry_mode: 'ttc' as const, tva_rate: 20, item_type: 'product' },
  { id: 'e1', quantity: 1, unit_price_ttc: 120, price_entry_mode: 'ttc' as const, tva_rate: 20, item_type: 'extra' },
]

describe('computeEffectiveTotals : produits + extras', () => {
  const t = computeEffectiveTotals(ITEMS)
  it('TTC effectif = produits (1200) + extra (120) = 1320', () => expect(t.totalTtc).toBe(1320))
  it('HT + TVA = TTC', () => expect(computeLineAmounts({ ...ITEMS[0] }).totalTtc).toBe(1000))
})

describe('applyLineCredit', () => {
  it('credit total (>= ligne) -> null (a supprimer)', () =>
    expect(applyLineCredit(ITEMS[1], 200)).toBeNull())
  it('credit partiel TTC -> ajoute une remise, total baisse du montant credite', () => {
    const modified = applyLineCredit(ITEMS[0], 300)!
    expect(computeLineAmounts(modified).totalTtc).toBe(700)
  })
})

describe('computeCreditNote : avoir = ancien effectif - nouveau effectif', () => {
  it('retrait total d un produit de 200', () => {
    const r = computeCreditNote(ITEMS, { p2: 200 }, 0, 960)
    expect(r.avoirTtc).toBe(200)
    expect(r.newEffectiveTtc).toBe(1120)
    expect(r.overpaidTtc).toBe(0)
    expect(r.creditedItems).toEqual([{ id: 'p2', creditedTtc: 200, remove: true, newDiscountAmount: null }])
  })
  it('credit d un extra de 120 baisse bien l effectif (pas 0)', () => {
    const r = computeCreditNote(ITEMS, { e1: 120 }, 0, 0)
    expect(r.avoirTtc).toBe(120)
    expect(r.newEffectiveTtc).toBe(1200)
  })
  it('trop-percu quand deja soldé', () => {
    const r = computeCreditNote(ITEMS, { p2: 200 }, 0, 1320)
    expect(r.overpaidTtc).toBe(200) // 1320 encaissé - 1120 nouveau
  })
  it('credit partiel : avoir = delta reel a la centime', () => {
    const r = computeCreditNote(ITEMS, { p1: 300 }, 0, 0)
    expect(r.avoirTtc).toBe(300)
    expect(r.newEffectiveTtc).toBe(1020)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm test credit-note`
Expected: FAIL — `computeEffectiveTotals`/`applyLineCredit`/`computeCreditNote` not exported.

- [ ] **Step 3: Write the implementation**

Append to `backend/src/lib/quote-rounding.ts`:

```typescript
// --- Facture d'avoir ---

export type EffectiveLineInput = LineAmountsInput & { item_type?: string | null }

// Total effectif = produits (avec remise en pied) + extras (hors remise).
// Reproduit exactement la base de la facture de solde : quote.total_ttc + Σ extras.total_ttc.
export function computeEffectiveTotals(
  items: EffectiveLineInput[],
  discountPercentage: number | null | undefined = 0,
): QuoteTotals {
  const products = items.filter((i) => i.item_type !== 'extra')
  const extras = items.filter((i) => i.item_type === 'extra')
  const prod = computeQuoteAmounts(products, discountPercentage)
  let extraHt = 0
  let extraTtc = 0
  for (const e of extras) {
    const l = computeLineAmounts(e)
    extraHt += l.totalHt
    extraTtc += l.totalTtc
  }
  const totalHt = round2(prod.totalHt + extraHt)
  const totalTtc = round2(prod.totalTtc + extraTtc)
  return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
}

// Applique un credit TTC sur une ligne. Retourne la ligne modifiee (remise augmentee,
// cote ancre selon price_entry_mode) ou null si la ligne est entierement creditee.
export function applyLineCredit(
  line: LineAmountsInput,
  creditedTtc: number,
): LineAmountsInput | null {
  const current = computeLineAmounts(line).totalTtc
  if (creditedTtc >= current - 1e-9) return null
  const rate = line.tva_rate ?? 0
  const mult = 1 + rate / 100
  const discount = line.discount_amount ?? 0
  const addDiscount =
    line.price_entry_mode === 'ttc' ? creditedTtc : rate <= -100 ? 0 : creditedTtc / mult
  return { ...line, discount_amount: round2(discount + addDiscount) }
}

export type CreditItemInput = EffectiveLineInput & { id: string }
export type CreditedItem = {
  id: string
  creditedTtc: number
  remove: boolean
  newDiscountAmount: number | null
}
export type CreditNoteResult = {
  avoirHt: number
  avoirTva: number
  avoirTtc: number
  oldEffectiveHt: number
  oldEffectiveTtc: number
  newEffectiveHt: number
  newEffectiveTtc: number
  overpaidTtc: number
  creditedItems: CreditedItem[]
}

// Coeur du calcul d'avoir. avoir = ancien total effectif - nouveau, mesure apres application.
export function computeCreditNote(
  items: CreditItemInput[],
  creditsByItemId: Record<string, number>,
  discountPercentage: number | null | undefined,
  collectedTtc: number,
): CreditNoteResult {
  const old = computeEffectiveTotals(items, discountPercentage)
  const creditedItems: CreditedItem[] = []
  const newItems: CreditItemInput[] = []
  for (const it of items) {
    const credit = creditsByItemId[it.id]
    if (!credit || credit <= 0) {
      newItems.push(it)
      continue
    }
    const modified = applyLineCredit(it, credit)
    if (modified === null) {
      creditedItems.push({
        id: it.id,
        creditedTtc: round2(computeLineAmounts(it).totalTtc),
        remove: true,
        newDiscountAmount: null,
      })
    } else {
      const actual = round2(computeLineAmounts(it).totalTtc - computeLineAmounts(modified).totalTtc)
      creditedItems.push({
        id: it.id,
        creditedTtc: actual,
        remove: false,
        newDiscountAmount: modified.discount_amount ?? null,
      })
      newItems.push({ ...it, discount_amount: modified.discount_amount })
    }
  }
  const neu = computeEffectiveTotals(newItems, discountPercentage)
  const avoirTtc = round2(old.totalTtc - neu.totalTtc)
  const avoirHt = round2(old.totalHt - neu.totalHt)
  return {
    avoirHt,
    avoirTva: round2(avoirTtc - avoirHt),
    avoirTtc,
    oldEffectiveHt: old.totalHt,
    oldEffectiveTtc: old.totalTtc,
    newEffectiveHt: neu.totalHt,
    newEffectiveTtc: neu.totalTtc,
    overpaidTtc: Math.max(0, round2(collectedTtc - neu.totalTtc)),
    creditedItems,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm test credit-note`
Expected: PASS (all cases).

- [ ] **Step 5: Run the full backend suite (no regression on rounding)**

Run: `cd backend && pnpm test`
Expected: PASS including `quote-rounding.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/quote-rounding.ts backend/tests/credit-note.test.ts
git commit -m "feat(avoir): moteur de calcul d'avoir (total effectif, credit ligne, delta)"
```

### Task 2: Mirror the helpers to the frontend copy

**Files:**
- Modify: `src/features/reservations/lib/quote-rounding.ts` (append after `computeBalanceTtc`)

- [ ] **Step 1: Copy the same block**

Append the exact same `computeEffectiveTotals` / `applyLineCredit` / `computeCreditNote` block (and their types) added in Task 1 to `src/features/reservations/lib/quote-rounding.ts`. The two files must stay byte-for-byte identical for these functions (file header states this invariant).

- [ ] **Step 2: Verify frontend typechecks**

Run: `pnpm build`
Expected: PASS (tsc + vite build succeed).

- [ ] **Step 3: Commit**

```bash
git add src/features/reservations/lib/quote-rounding.ts
git commit -m "feat(avoir): copie iso du moteur d'avoir cote frontend"
```

---

## Phase 2 — Database

### Task 3: Migration — tables, counter, atomic RPC, documents columns, RLS

**Files:**
- Create: `supabase/migrations/20260701_facture_avoir.sql`

- [ ] **Step 1: Read the RLS pattern to mirror**

Run: `grep -rn "enable row level security\|create policy" supabase/migrations supabase/schema.sql | grep -i "documents\|payments" | head`
Read one existing `create policy` on `documents` or `payments` and reuse its exact `USING` / `WITH CHECK` org-scoping expression in Step 2 (do not invent a new expression).

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260701_facture_avoir.sql`. Replace `<ORG_SCOPE_EXPR>` with the exact expression found in Step 1 (e.g. `organization_id in (select organization_id from ...)`):

```sql
-- Facture d'avoir : tables, compteur sequentiel, colonnes documents.

create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  avoir_number text not null,
  issued_at timestamptz not null default now(),
  reason text,
  total_ht numeric not null default 0,
  total_tva numeric not null default 0,
  total_ttc numeric not null default 0,
  old_effective_ttc numeric,
  new_effective_ttc numeric,
  overpaid_ttc numeric not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_credit_notes_quote on public.credit_notes(quote_id);
create index if not exists idx_credit_notes_booking on public.credit_notes(booking_id);
create index if not exists idx_credit_notes_org on public.credit_notes(organization_id);

create table if not exists public.credit_note_items (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.credit_notes(id) on delete cascade,
  source_quote_item_id uuid,
  name text not null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  tva_rate numeric not null default 0,
  item_type text not null default 'product',
  total_ht numeric not null default 0,
  total_ttc numeric not null default 0,
  credited_ttc numeric not null default 0
);
create index if not exists idx_credit_note_items_cn on public.credit_note_items(credit_note_id);

create table if not exists public.document_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid,
  doc_type text not null,
  year int not null,
  last_value int not null default 0,
  unique (organization_id, restaurant_id, doc_type, year)
);

alter table public.documents add column if not exists doc_kind text;
alter table public.documents add column if not exists credit_note_id uuid references public.credit_notes(id) on delete set null;

alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;
alter table public.document_counters enable row level security;

create policy "credit_notes org" on public.credit_notes for all
  using (<ORG_SCOPE_EXPR>) with check (<ORG_SCOPE_EXPR>);
create policy "credit_note_items via cn" on public.credit_note_items for all
  using (credit_note_id in (select id from public.credit_notes)) 
  with check (credit_note_id in (select id from public.credit_notes));
create policy "document_counters org" on public.document_counters for all
  using (<ORG_SCOPE_EXPR>) with check (<ORG_SCOPE_EXPR>);
```

- [ ] **Step 3: Write the atomic write function**

Append to the same migration file:

```sql
-- Cree un avoir de facon atomique : bump du compteur, insertion, reduction des lignes,
-- mise a jour des totaux du devis et figeage de l'acompte. Recoit des montants deja calcules.
create or replace function public.create_credit_note(
  p_organization_id uuid,
  p_restaurant_id uuid,
  p_booking_id uuid,
  p_quote_id uuid,
  p_reason text,
  p_new_total_ht numeric,
  p_new_total_tva numeric,
  p_new_total_ttc numeric,
  p_deposit_override numeric,
  p_avoir_ht numeric,
  p_avoir_tva numeric,
  p_avoir_ttc numeric,
  p_old_effective_ttc numeric,
  p_new_effective_ttc numeric,
  p_overpaid_ttc numeric,
  p_removed_item_ids uuid[],
  p_updated_items jsonb,     -- [{ "id": uuid, "discount_amount": numeric }]
  p_credit_items jsonb,      -- [{ name, description, quantity, unit_price, tva_rate, item_type, total_ht, total_ttc, credited_ttc, source_quote_item_id }]
  p_created_by uuid
) returns public.credit_notes
language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_number text;
  v_cn public.credit_notes;
  v_item jsonb;
begin
  insert into public.document_counters (organization_id, restaurant_id, doc_type, year, last_value)
    values (p_organization_id, p_restaurant_id, 'avoir', v_year, 1)
  on conflict (organization_id, restaurant_id, doc_type, year)
    do update set last_value = public.document_counters.last_value + 1
  returning last_value into v_seq;

  v_number := 'AV-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  update public.quotes
    set total_ht = p_new_total_ht,
        total_tva = p_new_total_tva,
        total_ttc = p_new_total_ttc,
        deposit_amount_override = coalesce(p_deposit_override, deposit_amount_override)
    where id = p_quote_id;

  if array_length(p_removed_item_ids, 1) is not null then
    delete from public.quote_items where id = any(p_removed_item_ids);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_updated_items, '[]'::jsonb)) loop
    update public.quote_items
      set discount_amount = (v_item->>'discount_amount')::numeric
      where id = (v_item->>'id')::uuid;
  end loop;

  insert into public.credit_notes (
    organization_id, restaurant_id, booking_id, quote_id, avoir_number, reason,
    total_ht, total_tva, total_ttc, old_effective_ttc, new_effective_ttc, overpaid_ttc, created_by
  ) values (
    p_organization_id, p_restaurant_id, p_booking_id, p_quote_id, v_number, p_reason,
    p_avoir_ht, p_avoir_tva, p_avoir_ttc, p_old_effective_ttc, p_new_effective_ttc, p_overpaid_ttc, p_created_by
  ) returning * into v_cn;

  for v_item in select * from jsonb_array_elements(coalesce(p_credit_items, '[]'::jsonb)) loop
    insert into public.credit_note_items (
      credit_note_id, source_quote_item_id, name, description, quantity, unit_price,
      tva_rate, item_type, total_ht, total_ttc, credited_ttc
    ) values (
      v_cn.id,
      nullif(v_item->>'source_quote_item_id','')::uuid,
      v_item->>'name', v_item->>'description',
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      (v_item->>'tva_rate')::numeric, coalesce(v_item->>'item_type','product'),
      (v_item->>'total_ht')::numeric, (v_item->>'total_ttc')::numeric, (v_item->>'credited_ttc')::numeric
    );
  end loop;

  return v_cn;
end;
$$;
```

- [ ] **Step 4: Apply the migration to the dev/branch DB and verify**

Apply via the Supabase MCP `apply_migration` (or the SQL editor for prod later, per project convention). Verify:

Run: `grep -c "create table" supabase/migrations/20260701_facture_avoir.sql`
Expected: `3`

- [ ] **Step 5: Regenerate Supabase types**

Regenerate `src/lib/supabase/types.ts` (Supabase CLI / MCP `generate_typescript_types`). Confirm `credit_notes`, `credit_note_items`, `document_counters` appear and `documents` has `doc_kind` / `credit_note_id`.

Run: `grep -c "credit_notes\|credit_note_items\|document_counters" src/lib/supabase/types.ts`
Expected: `> 0`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260701_facture_avoir.sql src/lib/supabase/types.ts
git commit -m "feat(avoir): tables credit_notes, compteur sequentiel, RPC create_credit_note"
```

---

## Phase 3 — Backend endpoint + PDF

### Task 4: `POST /api/quotes/:id/credit-note`

**Files:**
- Modify: `backend/src/routes/quotes.ts` (new route + helper; reuse `recalculateQuoteTotals` at :1403, `quoteDepositTtc` at :21, `savePdfAsDocument` at :51)

- [ ] **Step 1: Add the route handler**

In `backend/src/routes/quotes.ts`, add a route. Import the new calc helpers and `getPaidDeposits` logic (inline the ledger sum). Behaviour:

```typescript
// POST /:id/credit-note  { credits: [{ quote_item_id, credited_ttc }], reason }
quotesRouter.post('/:id/credit-note', requireAuth, async (req, res) => {
  const quoteId = req.params.id
  const { credits, reason } = req.body as {
    credits: { quote_item_id: string; credited_ttc: number }[]
    reason?: string
  }
  if (!Array.isArray(credits) || credits.length === 0) {
    return res.status(400).json({ error: 'NO_CREDITS' })
  }

  // 1. Load quote + items + booking (restaurant) + paid payments
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*, quote_items(*), booking:bookings(id, restaurant_id)')
    .eq('id', quoteId)
    .single()
  if (qErr || !quote) return res.status(404).json({ error: 'QUOTE_NOT_FOUND' })

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, payment_modality, payment_type, status')
    .eq('booking_id', quote.booking?.id)
    .in('status', ['paid', 'completed'])

  const collectedAcompte = (payments ?? [])
    .filter((p) => p.payment_modality === 'acompte' || p.payment_type === 'deposit')
    .reduce((s, p) => s + (p.amount || 0), 0)

  const items = (quote.quote_items ?? []).map((i: any) => ({
    id: i.id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_price_ttc: i.unit_price_ttc,
    price_entry_mode: i.price_entry_mode,
    discount_amount: i.discount_amount,
    tva_rate: i.tva_rate,
    item_type: i.item_type,
  }))

  // 2. Compute (shared lib)
  const creditsById: Record<string, number> = {}
  for (const c of credits) creditsById[c.quote_item_id] = c.credited_ttc
  const result = computeCreditNote(items, creditsById, quote.discount_percentage ?? 0, collectedAcompte)

  // Freeze acompte to the real collected amount (fallback: acompte on the OLD effective total)
  const frozenDeposit =
    collectedAcompte > 0
      ? round2(collectedAcompte)
      : quoteDepositTtc({ ...quote, total_ttc: result.oldEffectiveTtc })

  // New quote totals = products only (recalculateQuoteTotals recomputes; but the RPC needs the value)
  const productItemsAfter = items
    .filter((i) => !result.creditedItems.find((c) => c.id === i.id && c.remove))
    .map((i) => {
      const upd = result.creditedItems.find((c) => c.id === i.id && !c.remove)
      return upd ? { ...i, discount_amount: upd.newDiscountAmount } : i
    })
    .filter((i) => i.item_type !== 'extra')
  const newTotals = computeQuoteAmounts(productItemsAfter, quote.discount_percentage ?? 0)

  // 3. Snapshot credited lines for credit_note_items
  const creditItems = result.creditedItems.map((c) => {
    const src = quote.quote_items.find((i: any) => i.id === c.id)
    const line = computeLineAmounts(src)
    return {
      source_quote_item_id: c.id,
      name: src.name,
      description: src.description ?? null,
      quantity: src.quantity,
      unit_price: src.unit_price,
      tva_rate: src.tva_rate,
      item_type: src.item_type ?? 'product',
      total_ht: line.totalHt,
      total_ttc: line.totalTtc,
      credited_ttc: c.creditedTtc,
    }
  })

  // 4. Atomic write via RPC
  const { data: cn, error: rpcErr } = await supabase.rpc('create_credit_note', {
    p_organization_id: quote.organization_id,
    p_restaurant_id: quote.booking?.restaurant_id ?? null,
    p_booking_id: quote.booking?.id ?? null,
    p_quote_id: quoteId,
    p_reason: reason ?? null,
    p_new_total_ht: newTotals.totalHt,
    p_new_total_tva: newTotals.totalTva,
    p_new_total_ttc: newTotals.totalTtc,
    p_deposit_override: frozenDeposit,
    p_avoir_ht: result.avoirHt,
    p_avoir_tva: result.avoirTva,
    p_avoir_ttc: result.avoirTtc,
    p_old_effective_ttc: result.oldEffectiveTtc,
    p_new_effective_ttc: result.newEffectiveTtc,
    p_overpaid_ttc: result.overpaidTtc,
    p_removed_item_ids: result.creditedItems.filter((c) => c.remove).map((c) => c.id),
    p_updated_items: result.creditedItems
      .filter((c) => !c.remove)
      .map((c) => ({ id: c.id, discount_amount: c.newDiscountAmount })),
    p_credit_items: creditItems,
    p_created_by: (req as any).user?.id ?? null,
  })
  if (rpcErr || !cn) return res.status(500).json({ error: 'CREDIT_NOTE_FAILED', detail: rpcErr?.message })

  // 5. Side effects: PDF + document row
  try {
    const pdf = await generateCreditNotePdf(cn.id)
    const path = `${quote.organization_id}/quotes/${quoteId}/avoir-${cn.avoir_number}.pdf`
    await savePdfAsDocument(pdf, `Avoir - ${cn.avoir_number}`, path, {
      organization_id: quote.organization_id,
      booking_id: quote.booking?.id,
      doc_kind: 'avoir',
      credit_note_id: cn.id,
    })
  } catch (e) {
    // L'avoir existe ; le PDF est regenerable a la demande. On ne rollback pas.
    console.error('avoir pdf/storage failed', e)
  }

  res.json({ credit_note: cn })
})
```

Notes for the implementer:
- Import `computeCreditNote`, `computeQuoteAmounts`, `computeLineAmounts`, `round2` from `../lib/quote-rounding.js`.
- `savePdfAsDocument` (quotes.ts:51) currently takes `(pdfBuffer, fileName, filePath, meta)`-ish args; extend its `documents` insert to also write `doc_kind` and `credit_note_id` when provided (add optional 4th arg fields). Keep its existing callers working (default undefined).
- `generateCreditNotePdf` is added in Task 6.

- [ ] **Step 2: Extend `savePdfAsDocument` to accept `doc_kind` / `credit_note_id`**

Modify `savePdfAsDocument` (quotes.ts:51-105) so its `documents` insert includes `doc_kind` and `credit_note_id` when passed in a new optional options arg. Existing callers (devis/acompte/solde) pass nothing → columns stay null.

- [ ] **Step 3: Typecheck the backend**

Run: `cd backend && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/quotes.ts
git commit -m "feat(avoir): endpoint POST /quotes/:id/credit-note (atomique + PDF)"
```

### Task 5: Avoir PDF type

**Files:**
- Modify: `backend/src/lib/pdf-generator.ts` (`DocumentType` at :40, `labels` at :132, `docTitles` at :449, add avoir branch; add `generateCreditNotePdf`)

- [ ] **Step 1: Extend `DocumentType` and labels**

- Add `'avoir'` to `DocumentType` (line 40).
- Add `creditNote: "FACTURE D'AVOIR"` (fr) / `"CREDIT NOTE"` (en), `originalInvoiceRef: "Réf. facture d'origine"` / `"Original invoice ref."`, `creditReason: "Motif"` / `"Reason"` to `labels.fr` and `labels.en` (around 132-227).
- Wire `avoir` into `docTitles` (449-453).

- [ ] **Step 2: Add `generateCreditNotePdf(creditNoteId)`**

New exported function that fetches the `credit_notes` row + `credit_note_items` + the parent quote (for `quote_number`) + restaurant (issuer legal, reused as in `fetchQuoteFullData`), and builds a pdfmake doc mirroring the existing issuer/client/footer blocks (lines 512-573, 1817-1834) but with:
- title from `docTitles.avoir`, number = `avoir_number`, `originalInvoiceRef` = parent `quote_number`, `creditReason` = `reason`.
- a line table of `credit_note_items` showing credited amounts as negative (`-total_ttc`), TVA grouped by rate.
- total credited (HT/TVA/TTC) box; if `overpaid_ttc > 0`, a "Trop-perçu : X €" line. No payment schedule, no Stripe/bank block.

Reuse `formatEuroWhole` / `formatEuroDecimal` and the existing `buildDocDefinition` helpers/styles; factor shared header/footer if practical, otherwise a dedicated `buildCreditNoteDocDefinition`.

- [ ] **Step 3: Typecheck**

Run: `cd backend && pnpm build`
Expected: PASS.

- [ ] **Step 4: Smoke-test the PDF generation**

Add a temporary script or vitest that calls `generateCreditNotePdf` against a seeded credit note id on the dev DB and asserts a non-empty Buffer, or generate one via the download route in Task 6 and open it. Confirm the PDF renders title "FACTURE D'AVOIR", the reference, and negative amounts. Remove any temp script after.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/pdf-generator.ts
git commit -m "feat(avoir): type PDF avoir (facture d'avoir)"
```

### Task 6: Download route for an avoir PDF

**Files:**
- Modify: `backend/src/routes/quotes.ts` (mirror `GET /:id/download-pdf` at :1314)

- [ ] **Step 1: Add `GET /api/credit-notes/:id/download-pdf`** (or under the quotes router) that calls `generateCreditNotePdf(id)` and streams it inline (same headers as :1323). Auth via `requireAuth`.

- [ ] **Step 2: Typecheck + manual fetch**

Run: `cd backend && pnpm build` (PASS), then fetch the route with a valid token for a seeded avoir and confirm a PDF downloads.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/quotes.ts
git commit -m "feat(avoir): telechargement du PDF d'avoir"
```

---

## Phase 4 — Acompte freeze hardening (§9)

### Task 7: Freeze `deposit_amount_override` when an acompte is paid

**Files:**
- Modify: `backend/src/routes/webhooks.ts` (deposit-paid branch ~386-448)
- Modify: `src/features/reservations/hooks/use-bookings.ts` (manual payment mutation, deposit branch ~849-857)

- [ ] **Step 1: Webhook path**

In the `checkout.session.completed` deposit branch, when marking the quote `deposit_paid`, also set `deposit_amount_override` to the paid amount if it is currently null:

```typescript
// only freeze if not already frozen, so we don't overwrite a manual override
await supabase.from('quotes')
  .update({ status: 'deposit_paid', deposit_paid_at: new Date().toISOString(), deposit_amount_override: paidAmount })
  .eq('id', quoteId)
  .is('deposit_amount_override', null)
```
(Keep the existing non-override update for the case where it's already set — split into two updates or fetch-then-decide. Use the amount actually charged for the acompte.)

- [ ] **Step 2: Manual payment path**

In `use-bookings.ts` deposit branch (849-857), after setting `status: 'deposit_paid'`, also set `deposit_amount_override = amount` when the quote's `deposit_amount_override` is null. Read the paid `amount` from the mutation input.

- [ ] **Step 3: Verify**

Run: `pnpm build` and `cd backend && pnpm build`
Expected: PASS. Manually record a deposit payment in the preview app and confirm `quotes.deposit_amount_override` is set to the paid amount.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/webhooks.ts src/features/reservations/hooks/use-bookings.ts
git commit -m "feat(avoir): fige l'acompte en euros au paiement (webhook + manuel)"
```

---

## Phase 5 — Frontend UI

### Task 8: Hooks — create + list credit notes

**Files:**
- Modify: `src/features/reservations/hooks/use-quotes.ts` (mirror `useSendBalance` at :133 for the POST; mirror `useQuotesByBooking` for the query)

- [ ] **Step 1: `useCreateCreditNote`**

Mutation that POSTs to `/api/quotes/:id/credit-note` with `{ credits, reason }` and a Bearer token (same fetch pattern as `useSendBalance`). On success invalidate `['quote', quoteId]`, `['quotes', bookingId]`, `['credit-notes', bookingId]`, `['payments', bookingId]`.

- [ ] **Step 2: `useCreditNotesByBooking(bookingId)`**

Query `from('credit_notes').select('*, credit_note_items(*)').eq('booking_id', bookingId).order('issued_at', { ascending: false })`. Query key `['credit-notes', bookingId]`.

- [ ] **Step 3: Verify**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/reservations/hooks/use-quotes.ts
git commit -m "feat(avoir): hooks useCreateCreditNote + useCreditNotesByBooking"
```

### Task 9: Credit-note dialog (selection + confirmation)

**Files:**
- Create: `src/features/reservations/components/credit-note-dialog.tsx`

- [ ] **Step 1: Build the dialog**

A `Dialog` (shadcn, same imports as existing dialogs) that receives `quote` (with `quote_items`), `payments`, `open`, `onOpenChange`. State: a `Record<itemId, creditedTtc>` (default per checked line = its `total_ttc`), a `reason` string. Uses `computeCreditNote` (frontend copy) live to show: montant avoir, nouveau total effectif, nouveau solde (`newEffectiveTtc - collectedAll`), trop-perçu. Product and extra lines both listed (extras labelled). Confirmation via `AlertDialog` (clone the delete pattern at booking-detail.tsx:3474-3510), warning text adapted to engaged/non-engaged state. On confirm, call `useCreateCreditNote` with `credits = [{ quote_item_id, credited_ttc }]` for the checked lines, then `toast.success` / `toast.error` and close.

Reuse `formatEuroWhole` / `formatEuroAdaptive` from `@/features/reservations/lib/quote-rounding`.

- [ ] **Step 2: Verify**

Run: `pnpm build` and `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/reservations/components/credit-note-dialog.tsx
git commit -m "feat(avoir): dialogue de generation d'avoir (selection + confirmation)"
```

### Task 10: Wire the dropdown action + Avoirs sub-card + solde summary + Fichiers badge

**Files:**
- Modify: `src/features/reservations/components/booking-detail.tsx` (dropdown ~2127; facturation card ~after 2189; payment summary IIFE 2212-2326; fichiers list 2547)

- [ ] **Step 1: Dropdown item**

Add a `DropdownMenuItem` "Générer une facture d'avoir" before the "Supprimer" item (~2127) that opens the `CreditNoteDialog` for that quote (nullable state `creditNoteQuoteId`, mirroring `deleteQuoteId` at :218). Always enabled.

- [ ] **Step 2: Avoirs sub-card**

After the "Devis / Offres / Factures" `Card` closes (~after 2189), render a second `Card` titled "Avoirs" from `useCreditNotesByBooking(booking.id)`. One inline card per avoir: `avoir_number`, `issued_at` (fr date), `total_ttc` (`formatEuroWhole`), `reason`, and a download link hitting the Task 6 route. Empty state when none.

- [ ] **Step 3: Solde summary lines**

In the payment-summary IIFE (2212-2326), subtract issued avoirs where relevant is already reflected by the reduced `total_ttc`; add a display row "Avoirs émis" (sum of `credit_notes.total_ttc`) and, when the active quote has an avoir with `overpaid_ttc > 0`, a red "Trop-perçu" row. Do not double-count: the quote totals already reflect the reduction.

- [ ] **Step 4: Fichiers type badge**

In the fichiers list (2547-2572), add a small badge derived from `doc.doc_kind` (`avoir` → "Avoir", `facture_acompte` → "Facture acompte", etc.); fallback: parse the leading word of `doc.name` ("Avoir"/"Devis"/"Facture"). Display it next to the name.

- [ ] **Step 5: Verify in the preview app**

Run the preview server. On a booking with an engaged devis: open the dropdown → "Générer une facture d'avoir" → check a prestation → confirm. Verify: the quote TTC drops, an avoir card appears, the solde summary updates, and the avoir PDF appears in Fichiers with an "Avoir" badge and downloads correctly.

- [ ] **Step 6: Verify build + lint**

Run: `pnpm build` and `pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/reservations/components/booking-detail.tsx
git commit -m "feat(avoir): action devis, sous-carte Avoirs, recap solde, badge Fichiers"
```

---

## Self-review (spec coverage)

- Modèle de données (spec §3) → Task 3.
- Numérotation AV atomique (§4) → Task 3 (counter + RPC).
- Total effectif / extras (§5.1) → Task 1 `computeEffectiveTotals`; used in Task 4.
- Figer l'acompte à l'avoir (§5.2) → Task 4 (`frozenDeposit`); au paiement (§9) → Task 7.
- Réduction de ligne / partiel (§5.3) → Task 1 `applyLineCredit`; applied in Task 4 + RPC.
- Avoir = delta (§5.4) → Task 1 `computeCreditNote`.
- Cohérence solde, pas de ligne paiement (§5.5) → Task 4 never writes `payments`.
- Trop-perçu (§5.6) → Task 1 `overpaidTtc`, surfaced Task 5 (PDF) + Task 10 (summary).
- Flux UI (§6) → Tasks 9-10.
- PDF avoir (§7) → Tasks 5-6.
- Backend endpoint + atomicité (§8) → Tasks 3-4.
- Rôles: aucun gate (§11) → not implemented by design (verified none needed).
- Stockage (§10): avoir immuable + badge → Task 4 (unique path) + Task 10 (badge). No grouped fix (out of scope §14).

## Notes / risks for the executor

- The RPC `create_credit_note` is the only place that writes the reduction + counter + avoir together; keep it atomic, don't split into client-side calls.
- After the RPC, the frontend must invalidate `['quote', quoteId]` so the reduced totals show. The endpoint does not call `recalculateQuoteTotals` (the RPC sets totals directly from `computeQuoteAmounts` to stay in the transaction); make sure that value equals what `recalculateQuoteTotals` would produce (both use `computeQuoteAmounts(products, discount)`).
- Keep `quote-rounding.ts` copies identical (Task 2). Any later change lands in both.
- Migration touches `documents` (adds nullable columns) — safe/non-breaking. Existing rows unaffected.
