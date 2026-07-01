# Devis verbatim — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove business rounding (ceil-to-euro) and HT<->TTC derivation from quotes. Commercials type unit HT and unit TTC per line; the system stores them verbatim and sums. Keep the deposit as-is (% or fixed amount) and keep display formatting.

**Architecture:** `computeLineAmounts` gets a verbatim branch that triggers when BOTH unit prices are present (no derivation, no ceil, round2 only for centime float-noise). The editor stops deriving one side from the other. Preview/PDF read stored line totals. No DB migration (the "both units present" signal drives verbatim; legacy single-unit lines keep deriving).

**Tech Stack:** TypeScript, React 19, Express 4, Supabase, vitest (backend), pdfmake.

**Spec:** `docs/superpowers/specs/2026-07-01-devis-verbatim-design.md`

**Test reality:** backend uses vitest; frontend has no runner. Lib logic is TDD'd; editor/preview/PDF verified with `pnpm build`, `pnpm lint`, and the preview server on a real quote.

**Branch:** continue on `feat/facture-avoir` (the parked avoir work is compatible — its calc helpers aren't wired into the app), or the controller may branch `feat/devis-verbatim` off it. Do NOT work on main.

---

## Phase 1 — Verbatim line math (isomorphic, TDD)

### Task 1: `computeLineAmounts` verbatim branch (backend)

**Files:**
- Modify: `backend/src/lib/quote-rounding.ts` (`computeLineAmounts`, ~line 121)
- Test: `backend/tests/quote-rounding.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/quote-rounding.test.ts`:

```typescript
describe('Verbatim : les deux PU saisis, aucune derivation', () => {
  it('HT et TTC pris tels quels (TTC != HT*(1+tva))', () => {
    const l = computeLineAmounts({
      quantity: 2,
      unit_price: 10,
      unit_price_ttc: 12.5,
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(20)
    expect(l.totalTtc).toBe(25) // 2*12.5, PAS 2*10*1.2=24
    expect(l.totalTva).toBe(5)
  })
  it('remise soustraite des deux cotes', () => {
    const l = computeLineAmounts({
      quantity: 1,
      unit_price: 100,
      unit_price_ttc: 120,
      discount_amount: 20,
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(80)
    expect(l.totalTtc).toBe(100)
  })
  it('legacy HT seul (unit_price_ttc absent) -> derive comme avant', () => {
    const l = computeLineAmounts({
      quantity: 3,
      unit_price: 28.5,
      price_entry_mode: 'ht',
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(85.5)
    expect(l.totalTtc).toBe(102.6)
  })
})
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd /Users/thomas/Desktop/WINDSURF/restaurant-crm/backend && pnpm test quote-rounding`
Expected: the verbatim TTC=25 case FAILS (current code derives 24 via the ht branch, or NaN), the legacy case still passes.

- [ ] **Step 3: Add the verbatim branch**

In `backend/src/lib/quote-rounding.ts`, `computeLineAmounts`, add a branch at the very top of the function body (after computing `qty`/`rate`/`discount`/`mult`, before the existing `if (input.price_entry_mode === 'ttc')`):

```typescript
  // Verbatim : les deux PU saisis -> aucune derivation, on somme tel quel.
  // round2 ici = normalisation centime (anti-bruit flottant), pas un arrondi metier.
  if (input.unit_price != null && input.unit_price_ttc != null) {
    const totalHt = round2(qty * input.unit_price - discount)
    const totalTtc = round2(qty * input.unit_price_ttc - discount)
    return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
  }
```

Leave the existing `'ttc'` and `'ht'` branches unchanged (they handle legacy single-unit lines).

- [ ] **Step 4: Run, verify PASS**

Run: `cd /Users/thomas/Desktop/WINDSURF/restaurant-crm/backend && pnpm test quote-rounding`
Expected: PASS. Then full suite `pnpm test` — the existing DEVIS fixtures use `unit_price_ttc` WITHOUT `unit_price` (undefined), so they don't hit the verbatim branch and stay green.

- [ ] **Step 5: Commit**

```bash
cd /Users/thomas/Desktop/WINDSURF/restaurant-crm
git add backend/src/lib/quote-rounding.ts backend/tests/quote-rounding.test.ts
git commit -m "feat(devis): computeLineAmounts verbatim quand les deux PU sont saisis"
```

### Task 2: Mirror the verbatim branch to the frontend copy

**Files:**
- Modify: `src/features/reservations/lib/quote-rounding.ts` (`computeLineAmounts`)

- [ ] **Step 1: Add the identical branch**

Add the exact same verbatim branch (Step 3 of Task 1) at the same spot in `computeLineAmounts` in `src/features/reservations/lib/quote-rounding.ts`. Keep the two copies logically identical.

- [ ] **Step 2: Verify frontend typechecks**

Run: `cd /Users/thomas/Desktop/WINDSURF/restaurant-crm && pnpm exec tsc -b`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/reservations/lib/quote-rounding.ts
git commit -m "feat(devis): copie iso verbatim cote frontend"
```

---

## Phase 2 — Editor verbatim entry

### Task 3: Stop derivation in the row price handlers

**Files:**
- Modify: `src/features/reservations/components/quote-editor.tsx` (`SortableItemRow`, ~238-302)

- [ ] **Step 1: Read the three handlers**

Read `quote-editor.tsx:238-302`. Identify the TTC onBlur (~249-256), HT onBlur (~266-273), TVA onBlur (~282-299), and the TTC field `defaultValue` (~243-248).

- [ ] **Step 2: Edit the TTC onBlur**

It currently writes `price_entry_mode:'ttc'`, `unit_price_ttc: ttc`, AND `unit_price: deriveUnitHt(ttc, tva)`. Remove the `unit_price` derivation — write only `unit_price_ttc` (and `price_entry_mode:'ttc'`). Do not touch `unit_price`.

- [ ] **Step 3: Edit the HT onBlur**

It currently writes `price_entry_mode:'ht'`, `unit_price: ht`, AND `unit_price_ttc: null` (wipes TTC). Remove the `unit_price_ttc: null` wipe — write only `unit_price` (and `price_entry_mode:'ht'`). Leave any existing `unit_price_ttc` intact.

- [ ] **Step 4: Edit the TVA onBlur**

It currently, when mode is `'ttc'`, re-derives `unit_price` via `deriveUnitHt(ttc, newTva)`. Remove that derivation branch. The TVA change now only updates `tva_rate` (used for display/grouping); it must not recompute either unit price.

- [ ] **Step 5: TTC field defaultValue**

Ensure the TTC input shows `unit_price_ttc` verbatim when present; keep the derived fallback ONLY when `unit_price_ttc` is null (legacy line). Remove the `deriveUnitHt` import if it becomes unused (check other usages first).

- [ ] **Step 6: Verify**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: PASS. Start the preview server, open a quote, edit a line: type a HT then a TTC that is NOT `HT*(1+tva)` (e.g. HT 100, TTC 130 with tva 20). Confirm both stick (the TTC is not overwritten to 120), the line Total HT/TTC reflect both, and the quote total sums them.

- [ ] **Step 7: Commit**

```bash
git add src/features/reservations/components/quote-editor.tsx
git commit -m "feat(devis): saisie PU HT/TTC independante (arret de la derivation)"
```

### Task 4: Extras dialog dual entry

**Files:**
- Modify: `src/features/reservations/components/quote-editor.tsx` (Extras dialog ~2306-2412)

- [ ] **Step 1: Read the extras dialog**

Read `quote-editor.tsx:2306-2412`. It currently exposes one "Prix unitaire TTC" input and stores `unit_price: deriveHtFromTtc(ttc, tva)` (from `src/lib/price.ts`) with no `unit_price_ttc`.

- [ ] **Step 2: Add a PU HT input + store both units**

Add a "Prix unitaire HT" input next to the TTC one. On save, pass BOTH `unitPrice` (HT, typed) and `unitPriceTtc` (TTC, typed) to the add/update mutation, and drop the `deriveHtFromTtc(...)` call. Remove the `= X € HT` derived hint (~2322-2329). Remove the now-unused `deriveHtFromTtc` import if no other caller in this file uses it (leave `src/lib/price.ts` itself alone).

- [ ] **Step 3: Verify add-item call sites pass both units**

In `src/features/reservations/hooks/use-quotes.ts`, `useAddQuoteItem` already accepts `unitPriceTtc`/`priceEntryMode` and persists both columns. Confirm the extras add/update path now passes both. Manual "Produit manuel" and catalog adds keep passing HT only (unit_price_ttc stays null → derived until the commercial types a TTC) — no change required there.

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: PASS. In preview, add an extra with HT 100 / TTC 130 (tva 20) and confirm both are stored and shown verbatim.

- [ ] **Step 5: Commit**

```bash
git add src/features/reservations/components/quote-editor.tsx
git commit -m "feat(devis): extras en saisie HT+TTC verbatim"
```

---

## Phase 3 — Preview + PDF read stored values

### Task 5: Preview reads stored line totals

**Files:**
- Modify: `src/features/reservations/components/quote-preview.tsx` (`computeItemTtc:473`, `computeItemHt:484`, `computeItemUnitTtc:495`, tvaByRate ~514-520)

- [ ] **Step 1: Read the compute helpers**

Read `quote-preview.tsx:465-521`. `computeItemTtc`/`computeItemHt` currently recompute per-line via `computeLineAmounts`; `computeItemUnitTtc` derives unit TTC via `deriveUnitTtc`.

- [ ] **Step 2: Return stored values**

Change `computeItemTtc(item)` to return `item.total_ttc ?? computeLineAmounts(item).totalTtc` and `computeItemHt(item)` to return `item.total_ht ?? computeLineAmounts(item).totalHt` (stored first, `computeLineAmounts` only as a fallback for items lacking stored totals). `computeItemUnitTtc` returns `item.unit_price_ttc` when present, else the derived value. The per-rate `tvaByRate` grouping now sums stored `total_ht`/`total_ttc` per `tva_rate`.

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: PASS. In preview, confirm a line with mismatched HT/TTC (from Task 3) renders the stored values (not a re-derived TTC), and the TVA breakdown sums stored per-line TVA.

- [ ] **Step 4: Commit**

```bash
git add src/features/reservations/components/quote-preview.tsx
git commit -m "feat(devis): preview lit les totaux de ligne stockes (verbatim)"
```

### Task 6: Server PDF reads stored values

**Files:**
- Modify: `backend/src/lib/pdf-generator.ts` (line-table + totals branches)

- [ ] **Step 1: Audit the PDF line rendering**

Read the products/solde line-table branches (`:752-921`, `:926-1207`) and the totals branches (`:1209+`). Confirm they render `quote.total_ht/total_tva/total_ttc` and per-line `total_ht`/`total_ttc` stored values. Identify any spot that RE-derives (e.g. a raw-HT reconstruction at `:1230-1231`, or unit TTC derivation) and switch it to the stored value.

- [ ] **Step 2: Apply verbatim reads**

Where the PDF recomputes a line HT/TTC or a unit price from the other side, read the stored column instead. Do NOT change `resolveDepositTtc`/`resolveDepositHt` (deposit stays as-is, % kept) or the payments-based solde (`:1500`). Keep all `formatEuro*` display.

- [ ] **Step 3: Verify**

Run: `cd backend && pnpm build`
Expected: PASS. Generate a devis PDF (via the download route) for a quote with a mismatched-HT/TTC line and confirm the printed HT/TTC/TVA match the stored line values, and the totals equal the plain sum.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/pdf-generator.ts
git commit -m "feat(devis): PDF imprime les valeurs stockees (verbatim)"
```

---

## Phase 4 — Acompte freeze hardening

### Task 7: Freeze `deposit_amount_override` when an acompte is paid

**Files:**
- Modify: `backend/src/routes/webhooks.ts` (deposit-paid branch ~386-448)
- Modify: `src/features/reservations/hooks/use-bookings.ts` (manual payment deposit branch ~849-857)

- [ ] **Step 1: Webhook path**

When the webhook marks a quote `deposit_paid`, also set `deposit_amount_override = <paid amount>` only when it is currently null (don't overwrite an existing manual override). Use the actual acompte amount charged.

- [ ] **Step 2: Manual payment path**

In `use-bookings.ts` deposit branch, after setting `status: 'deposit_paid'`, also set `deposit_amount_override = amount` when the quote's `deposit_amount_override` is null. Read the paid `amount` from the mutation input.

- [ ] **Step 3: Verify**

Run: `pnpm build && cd backend && pnpm build`
Expected: PASS. Record a manual deposit payment in preview and confirm `quotes.deposit_amount_override` is set to the paid amount, and the deposit invoice keeps showing that fixed amount even if the quote total is later edited.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/webhooks.ts src/features/reservations/hooks/use-bookings.ts
git commit -m "feat(devis): fige l'acompte en euros au paiement (webhook + manuel)"
```

---

## Self-review (spec coverage)

- Verbatim line math, both-present signal, round2-centime (spec §2, §3.1) → Task 1-2.
- Editor stops derivation, both PU editable (spec §3.2) → Task 3.
- Extras dual entry, drop deriveHtFromTtc (spec §5) → Task 4.
- Preview + PDF read stored values (spec §3.3) → Task 5-6.
- Acompte freeze on payment (spec §3.4) → Task 7.
- Deposit % kept, no migration (spec §2, §8) → nothing removed; verified in Task 3/6 (no deposit code change).
- Legacy lines keep deriving (spec §2, §5) → Task 1 branch condition (`both present`); existing tests stay green (Task 1 Step 4).

## Notes / risks for the executor

- The verbatim branch triggers ONLY when both `unit_price` and `unit_price_ttc` are non-null. Existing `'ttc'` lines have both (the HT was derived), so they become verbatim on next edit with ~identical results; existing `'ht'` lines have `unit_price_ttc` null and keep deriving. Do not add a new `price_entry_mode` and do not migrate.
- Keep the two `quote-rounding.ts` copies logically identical (Task 2).
- No DB migration in this plan. The parked avoir migration (`20260701_facture_avoir.sql`) is unrelated and stays unapplied.
- Deposit/solde code is intentionally untouched (both modes kept). Do not remove `deposit_percentage` or the `%` labels.
