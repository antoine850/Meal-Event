# Ancre de prix unique par ligne — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une seule ancre de prix par ligne (`price_entry_mode`, TTC défaut), l'autre côté dérivé en cache ; totaux devis = somme des totaux de lignes stockés ; toggle TTC|HT sur devis et catalogue ; aucune écriture sans modification réelle.

**Architecture:** La lib `quote-rounding.ts` (2 copies isomorphes front/back) perd la branche verbatim double-ancre et gagne `resolveUnitPrices` + `sumStoredQuoteTotals`. Les hooks et routes persistent ancre + dérivés et somment les totaux stockés. L'éditeur passe en inputs contrôlés avec toggle et gardes de comparaison. Le catalogue stocke le prix tapé verbatim (migration `products`).

**Tech Stack:** React 19 + TS strict, TanStack Query, Supabase (PostgREST direct côté front), Express backend, vitest (backend uniquement — pas d'infra test front : vérifs via `tsc`/`pnpm build`), scripts Python `scripts/booking_shake_import/lib.py`.

**Spec:** `docs/superpowers/specs/2026-07-06-ancre-prix-unique-design.md`
**Branche:** `feat/ancre-prix-unique`

**Règles transverses:**
- Les 2 copies de `quote-rounding.ts` (`src/features/reservations/lib/` et `backend/src/lib/`) doivent rester identiques fonction par fonction (seuls les commentaires d'en-tête diffèrent).
- Commits : sujet court en français, style `feat(devis): ...`, pas de body, pas de Co-Authored-By.
- Vérif front : `pnpm build` (racine). Vérif back : `cd backend && pnpm build && pnpm test`.

---

### Task 1: Lib backend — computeLineAmounts mono-ancre, resolveUnitPrices, sumStoredQuoteTotals (TDD)

**Files:**
- Modify: `backend/src/lib/quote-rounding.ts` (computeLineAmounts ~l.150-180, ajouts après `displayUnitTtc`)
- Test: `backend/tests/quote-rounding.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `backend/tests/quote-rounding.test.ts` (imports à compléter : `resolveUnitPrices`, `sumStoredQuoteTotals`, `displayUnitHt`, `formatUnitPriceEuro`) :

```typescript
describe('computeLineAmounts mono-ancre (price_entry_mode fait foi)', () => {
  it('mode ttc : ancre TTC, cas SPLASH 16 x 39.99 = 639.84', () => {
    const l = computeLineAmounts({
      quantity: 16,
      unit_price: 36.35,
      unit_price_ttc: 39.99,
      price_entry_mode: 'ttc',
      tva_rate: 10,
    })
    expect(l.totalTtc).toBe(639.84)
    expect(l.totalHt).toBe(581.67) // round2(639.84 / 1.1)
    expect(l.totalTva).toBe(58.17)
  })
  it('mode ht : ancre HT même si unit_price_ttc (cache) est présent', () => {
    const l = computeLineAmounts({
      quantity: 16,
      unit_price: 36.35,
      unit_price_ttc: 39.99, // cache périmé — ne doit PAS piloter le total
      price_entry_mode: 'ht',
      tva_rate: 10,
    })
    expect(l.totalHt).toBe(581.6)
    expect(l.totalTtc).toBe(639.76)
  })
  it('mode ttc : remise appliquée côté ancre (TTC)', () => {
    const l = computeLineAmounts({
      quantity: 10,
      unit_price_ttc: 15,
      price_entry_mode: 'ttc',
      discount_amount: 20,
      tva_rate: 10,
    })
    expect(l.totalTtc).toBe(130) // round2(150 - 20)
    expect(l.totalHt).toBe(118.18)
  })
  it('mode ttc sans unit_price_ttc : fallback unit_price x mult (legacy)', () => {
    const l = computeLineAmounts({
      quantity: 2,
      unit_price: 100,
      price_entry_mode: 'ttc',
      tva_rate: 20,
    })
    expect(l.totalTtc).toBe(240)
  })
})

describe('resolveUnitPrices : les deux PU persistés, ancre intacte', () => {
  it('mode ttc : ancre 39.99 gardée, HT dérivé', () => {
    const u = resolveUnitPrices({
      unit_price_ttc: 39.99,
      price_entry_mode: 'ttc',
      tva_rate: 10,
    })
    expect(u.unit_price_ttc).toBe(39.99)
    expect(u.unit_price).toBe(36.35) // deriveUnitHt(39.99, 10)
  })
  it('mode ht : ancre 36.35 gardée, TTC dérivé', () => {
    const u = resolveUnitPrices({
      unit_price: 36.35,
      price_entry_mode: 'ht',
      tva_rate: 10,
    })
    expect(u.unit_price).toBe(36.35)
    expect(u.unit_price_ttc).toBe(39.99) // deriveUnitTtc
  })
})

describe('sumStoredQuoteTotals : somme des totaux stockés, remise en pied', () => {
  const items = [
    { total_ht: 581.6, total_ttc: 639.76 },
    { total_ht: 100, total_ttc: 120 },
  ]
  it('sans remise', () => {
    const t = sumStoredQuoteTotals(items, 0)
    expect(t.totalHt).toBe(681.6)
    expect(t.totalTtc).toBe(759.76)
    expect(t.totalTva).toBe(78.16)
  })
  it('remise 10% appliquée une fois en pied', () => {
    const t = sumStoredQuoteTotals(items, 10)
    expect(t.totalTtc).toBe(683.78) // round2(759.76 * 0.9)
    expect(t.totalHt).toBe(613.44)
  })
  it('ligne à totaux NULL : recalcul de secours via computeLineAmounts', () => {
    const t = sumStoredQuoteTotals(
      [
        { total_ht: null, total_ttc: null, quantity: 2, unit_price: 50,
          price_entry_mode: 'ht', tva_rate: 20 },
      ],
      0
    )
    expect(t.totalHt).toBe(100)
    expect(t.totalTtc).toBe(120)
  })
})

describe('displayUnitHt + formatUnitPriceEuro (PU adaptatif)', () => {
  it('displayUnitHt : total stocké / qté quand pas de remise', () => {
    expect(displayUnitHt({ quantity: 3, unit_price: 29.17, total_ht: 87.5 }))
      .toBeCloseTo(29.166666, 4)
  })
  it('formatUnitPriceEuro : 2 décimales quand exact', () => {
    expect(formatUnitPriceEuro(39.99)).toBe('39,99 €')
  })
  it('formatUnitPriceEuro : étend à 3-4 décimales quand nécessaire', () => {
    expect(formatUnitPriceEuro(639.76 / 16)).toBe('39,985 €')
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && pnpm test`
Expected: FAIL — `resolveUnitPrices is not exported`, `sumStoredQuoteTotals is not exported`, et le test « mode ht avec cache présent » échoue (la branche verbatim actuelle renvoie 639.84).

- [ ] **Step 3: Implémenter dans backend/src/lib/quote-rounding.ts**

Remplacer le corps de `computeLineAmounts` (supprimer la branche `if (input.unit_price != null && input.unit_price_ttc != null)`) :

```typescript
// Totaux d'une ligne : l'ancre (price_entry_mode) fait foi, l'autre côté est dérivé.
// La remise s'applique côté ancre. Aucun ceil ; round2 = normalisation centime.
export function computeLineAmounts(input: LineAmountsInput): QuoteTotals {
  const qty = input.quantity ?? 0
  const rate = input.tva_rate ?? 0
  const discount = input.discount_amount ?? 0
  const mult = 1 + rate / 100

  if (input.price_entry_mode === 'ttc') {
    const unitTtc = input.unit_price_ttc ?? (input.unit_price ?? 0) * mult
    const totalTtc = round2(qty * unitTtc - discount)
    const totalHt = rate <= -100 ? 0 : round2(totalTtc / mult)
    return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
  }
  const unitHt = input.unit_price ?? 0
  const totalHt = round2(qty * unitHt - discount)
  const totalTtc = round2(totalHt * mult)
  return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
}
```

Ajouter après `displayUnitTtc` :

```typescript
// PU HT à afficher : symétrique de displayUnitTtc (total stocké / qté prioritaire).
export function displayUnitHt(
  item: LineAmountsInput & { total_ht?: number | null }
): number {
  if (item.price_entry_mode !== 'ttc' && item.unit_price != null) {
    const qty = item.quantity ?? 0
    if (item.total_ht != null && qty > 0 && !item.discount_amount) {
      // ancre HT : si le stocké round-trip depuis le PU, afficher le PU saisi
      if (round2(qty * item.unit_price) === round2(item.total_ht))
        return item.unit_price
      return item.total_ht / qty
    }
    return item.unit_price
  }
  const qty = item.quantity ?? 0
  if (item.total_ht != null && qty > 0 && !item.discount_amount)
    return item.total_ht / qty
  return deriveUnitHt(item.unit_price_ttc ?? 0, item.tva_rate ?? 20)
}

// Les deux PU à persister : l'ancre telle que saisie, l'autre côté en cache dérivé.
export function resolveUnitPrices(input: {
  unit_price?: number | null
  unit_price_ttc?: number | null
  price_entry_mode?: string | null
  tva_rate?: number | null
}): { unit_price: number; unit_price_ttc: number } {
  const rate = input.tva_rate ?? 20
  if (input.price_entry_mode === 'ttc') {
    const ttc = input.unit_price_ttc ?? deriveUnitTtc(input.unit_price ?? 0, rate)
    return { unit_price: deriveUnitHt(ttc, rate), unit_price_ttc: ttc }
  }
  const ht = input.unit_price ?? deriveUnitHt(input.unit_price_ttc ?? 0, rate)
  return { unit_price: ht, unit_price_ttc: deriveUnitTtc(ht, rate) }
}

export type StoredLine = LineAmountsInput & {
  total_ht?: number | null
  total_ttc?: number | null
}

// Totaux du devis = somme des totaux de lignes STOCKÉS (recalcul en secours si NULL),
// remise globale appliquée une fois en pied. Les lignes non touchées ne bougent jamais.
export function sumStoredQuoteTotals(
  items: StoredLine[],
  discountPercentage: number | null | undefined = 0
): QuoteTotals {
  let subHt = 0
  let subTtc = 0
  for (const item of items) {
    if (item.total_ht != null && item.total_ttc != null) {
      subHt += item.total_ht
      subTtc += item.total_ttc
    } else {
      const line = computeLineAmounts(item)
      subHt += line.totalHt
      subTtc += line.totalTtc
    }
  }
  subHt = round2(subHt)
  subTtc = round2(subTtc)
  const pct = discountPercentage ?? 0
  const mult = pct > 0 ? 1 - pct / 100 : 1
  const totalHt = round2(subHt * mult)
  const totalTtc = round2(subTtc * mult)
  return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
}

// Format PU : 2 décimales par défaut, étendu à 3-4 quand la valeur exacte l'exige
// (lignes historiques dont le PU n'est pas représentable en 2 décimales).
export function formatUnitPriceEuro(amount: number): string {
  const needsMore = Math.abs(amount - Math.round(amount * 100) / 100) > 5e-5
  return normalizeFrenchSpaces(
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: needsMore ? 4 : 2,
    }).format(amount)
  )
}
```

- [ ] **Step 4: Adapter les tests existants de la branche verbatim**

Dans `backend/tests/quote-rounding.test.ts`, les tests existants qui supposaient « les deux PU présents => verbatim » (totaux TTC = qty × unit_price_ttc en mode 'ht') doivent être mis à jour : l'attendu devient l'ancre du `price_entry_mode`. Ne PAS supprimer les cas Foolish Studio (`DEVIS` en mode 'ttc') : ils restent valides tels quels.

- [ ] **Step 5: Vérifier que tout passe**

Run: `cd backend && pnpm test`
Expected: PASS (tous, y compris les 59 existants adaptés)

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/quote-rounding.ts backend/tests/quote-rounding.test.ts
git commit -m "feat(devis): lib mono-ancre, somme des totaux stockes et PU adaptatif (backend)"
```

---

### Task 2: Lib frontend — copie isomorphe

**Files:**
- Modify: `src/features/reservations/lib/quote-rounding.ts`

- [ ] **Step 1: Porter à l'identique les changements de la Task 1**

Appliquer exactement les mêmes modifications que Task 1 Step 3 dans `src/features/reservations/lib/quote-rounding.ts` : même corps de `computeLineAmounts` (suppression de la branche verbatim), mêmes ajouts `displayUnitHt`, `resolveUnitPrices`, `StoredLine`, `sumStoredQuoteTotals`, `formatUnitPriceEuro` (code identique octet pour octet à la copie backend, seuls les commentaires d'en-tête de fichier diffèrent). Supprimer aussi l'en-tête obsolète des lignes 1-5 (« chaque ligne TTC est arrondie au supérieur à l'euro entier ») et le remplacer par : `// Source de vérité des montants de devis. Ancre par ligne (price_entry_mode), copie isomorphe de backend/src/lib/quote-rounding.ts.`

- [ ] **Step 2: Vérifier la parité des deux copies**

Run: `diff <(grep -v '^//' src/features/reservations/lib/quote-rounding.ts) <(grep -v '^//' backend/src/lib/quote-rounding.ts)`
Expected: aucune différence (ou uniquement des lignes de commentaires si des commentaires inline diffèrent — dans ce cas les aligner).

- [ ] **Step 3: Vérifier la compilation front**

Run: `pnpm build`
Expected: PASS (les usages existants de `computeLineAmounts`/`computeQuoteAmounts` compilent sans changement de signature)

- [ ] **Step 4: Commit**

```bash
git add src/features/reservations/lib/quote-rounding.ts
git commit -m "feat(devis): copie frontend iso de la lib mono-ancre"
```

---

### Task 3: Hooks use-quotes — persistance ancre+dérivés, recalcul = somme des stockés, remise globale

**Files:**
- Modify: `src/features/reservations/hooks/use-quotes.ts` (imports l.1-11, useAddQuoteItem l.1040-1114, useUpdateQuoteItem l.1116-1186, recalculateQuoteTotals l.1235-1267, useUpdateQuote)

- [ ] **Step 1: Mettre à jour les imports**

```typescript
import {
  computeLineAmounts,
  resolveUnitPrices,
  sumStoredQuoteTotals,
  type PriceEntryMode,
} from '@/features/reservations/lib/quote-rounding'
```

(`computeQuoteAmounts` n'est plus utilisé dans ce fichier — le retirer de l'import.)

- [ ] **Step 2: useAddQuoteItem — persister les deux PU résolus**

Dans le `mutationFn`, avant l'insert :

```typescript
      const units = resolveUnitPrices({
        unit_price: unitPrice,
        unit_price_ttc: unitPriceTtc,
        price_entry_mode: priceEntryMode,
        tva_rate: tvaRate,
      })
      const line = computeLineAmounts({
        quantity,
        unit_price: units.unit_price,
        unit_price_ttc: units.unit_price_ttc,
        price_entry_mode: priceEntryMode,
        discount_amount: discountAmount,
        tva_rate: tvaRate,
      })
```

et dans le payload d'insert, remplacer les deux lignes PU par :

```typescript
          unit_price: units.unit_price,
          unit_price_ttc: units.unit_price_ttc,
```

(le défaut `price_entry_mode: priceEntryMode ?? 'ht'` reste — les appelants UI passeront le mode explicitement).

- [ ] **Step 3: useUpdateQuoteItem — résoudre les deux PU quand un champ prix change**

Dans le bloc `if (quantity !== undefined || ...)`, après le fetch de `current`, remplacer le calcul de `line` et l'enrichissement d'`updates` par :

```typescript
        const mode = (priceEntryMode ??
          (current as any)?.price_entry_mode ??
          'ht') as PriceEntryMode
        const units = resolveUnitPrices({
          unit_price: unitPrice ?? (current as any)?.unit_price,
          unit_price_ttc: unitPriceTtc ?? (current as any)?.unit_price_ttc,
          price_entry_mode: mode,
          tva_rate: tvaRate ?? (current as any)?.tva_rate ?? 20,
        })
        const line = computeLineAmounts({
          quantity: quantity ?? (current as any)?.quantity ?? 1,
          unit_price: units.unit_price,
          unit_price_ttc: units.unit_price_ttc,
          price_entry_mode: mode,
          discount_amount:
            discountAmount ?? (current as any)?.discount_amount ?? 0,
          tva_rate: tvaRate ?? (current as any)?.tva_rate ?? 20,
        })

        updates = {
          ...updates,
          unit_price: units.unit_price,
          unit_price_ttc: units.unit_price_ttc,
          total_ht: line.totalHt,
          total_ttc: line.totalTtc,
        } as any
```

Exception : si l'appelant passe UNIQUEMENT `price_entry_mode` (bascule de toggle, Task 5), ne pas re-résoudre les PU depuis l'ancre 2-décimales — le toggle envoie lui-même le PU 4-décimales correct. Le code ci-dessus le respecte déjà : `unitPriceTtc`/`unitPrice` passés par le toggle priment sur `current`.

- [ ] **Step 4: recalculateQuoteTotals — somme des totaux stockés**

Remplacer le corps (l.1235-1267) :

```typescript
async function recalculateQuoteTotals(quoteId: string) {
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)

  if (!items) return

  // Extras facturés séparément, exclus du total devis
  const productItems = (items as any[]).filter(
    (item: any) => item.item_type !== 'extra'
  )

  const { data: quote } = await supabase
    .from('quotes')
    .select('discount_percentage')
    .eq('id', quoteId)
    .single()

  // Somme des totaux de lignes STOCKÉS : éditer une ligne ne reprice jamais les autres.
  const totals = sumStoredQuoteTotals(
    productItems,
    (quote as any)?.discount_percentage
  )

  await supabase
    .from('quotes')
    .update({
      total_ht: totals.totalHt,
      total_tva: totals.totalTva,
      total_ttc: totals.totalTtc,
    } as never)
    .eq('id', quoteId)
}
```

- [ ] **Step 5: useUpdateQuote — recalculer les totaux quand la remise globale change**

Localiser `useUpdateQuote` (mutation update de la table `quotes`). Dans son `mutationFn`, après l'update réussi, ajouter :

```typescript
      if ('discount_percentage' in updates) {
        await recalculateQuoteTotals(id)
      }
```

(adapter les noms `updates`/`id` à la signature réelle de la mutation ; `recalculateQuoteTotals` est déjà dans le scope du module). Cela couvre `saveAllFields` ET le blur du champ remise (`saveQuoteField('discount_percentage', v)`).

- [ ] **Step 6: Vérifier la compilation et commit**

Run: `pnpm build`
Expected: PASS

```bash
git add src/features/reservations/hooks/use-quotes.ts
git commit -m "feat(devis): ecriture ancre+derives, totaux = somme des lignes stockees, recalc remise globale"
```

---

### Task 4: Migration products + catalogue (product-dialog, save-to-catalog, price.ts)

**Files:**
- Create: `supabase/migrations/20260707_products_price_anchor.sql`
- Modify: `src/features/settings/hooks/use-products.ts` (type Product l.9-31)
- Modify: `src/features/settings/products/product-dialog.tsx`
- Modify: `src/features/reservations/components/save-to-catalog-dialog.tsx`
- Modify: `src/lib/price.ts`
- Modify: `src/lib/supabase/types.ts` (products Row/Insert/Update)

- [ ] **Step 1: Écrire la migration**

```sql
-- Le catalogue stocke le prix tel que saisi : unit_price_ttc devient une vraie colonne
-- (valeurs actuelles conservées) et price_entry_mode designe l'ancre (ttc par defaut,
-- tous les produits existants ont ete saisis en TTC).
ALTER TABLE products ALTER COLUMN unit_price_ttc DROP EXPRESSION;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_entry_mode text NOT NULL DEFAULT 'ttc'
    CHECK (price_entry_mode IN ('ht', 'ttc'));
```

- [ ] **Step 2: Appliquer la migration en prod**

Via MCP Supabase (`apply_migration`) si authentifié, sinon la coller dans l'éditeur SQL Supabase (demander à l'utilisateur). NE PAS continuer la task tant que la migration n'est pas appliquée (le front qui écrit `unit_price_ttc` échouerait sur une colonne générée).

- [ ] **Step 3: Mettre à jour les types**

Dans `src/features/settings/hooks/use-products.ts`, ajouter au type `Product` :

```typescript
  price_entry_mode: 'ht' | 'ttc'
```

Dans `src/lib/supabase/types.ts`, table `products` : ajouter `price_entry_mode: string` au Row (et `price_entry_mode?: string` à Insert/Update), et vérifier que `unit_price_ttc` y est bien en écriture (`unit_price_ttc?: number` dans Insert/Update — l'ajouter s'il était absent car généré). Si le MCP Supabase est authentifié, régénérer le fichier entier à la place.

- [ ] **Step 4: product-dialog — toggle TTC|HT, prix tapé stocké verbatim**

Dans `product-dialog.tsx` :
- Remplacer l'import `deriveHtFromTtc` par `deriveUnitHt, deriveUnitTtc` depuis `@/features/reservations/lib/quote-rounding` (garder `normalizeTvaRate` de `@/lib/price`).
- États : remplacer `unitPriceTtc` par `priceMode` + `priceInput` :

```typescript
  const [priceMode, setPriceMode] = useState<'ht' | 'ttc'>('ttc')
  const [priceInput, setPriceInput] = useState('')
```

- Initialisation (useEffect, branche `source`) :

```typescript
        setPriceMode((source.price_entry_mode as 'ht' | 'ttc') ?? 'ttc')
        setPriceInput(
          String(
            (source.price_entry_mode ?? 'ttc') === 'ttc'
              ? source.unit_price_ttc
              : source.unit_price_ht
          )
        )
```

(branche reset : `setPriceMode('ttc')` ; `setPriceInput('')`).
- Valeur dérivée affichée (remplace le useMemo `priceHt`) :

```typescript
  const rate = normalizeTvaRate(parseFloat(tvaRate) || 0)
  const typed = parseFloat(priceInput) || 0
  const derived =
    priceMode === 'ttc' ? deriveUnitHt(typed, rate) : deriveUnitTtc(typed, rate)
```

- Payload : remplacer `unit_price_ht: deriveHtFromTtc(...)` par :

```typescript
      unit_price_ht: priceMode === 'ht' ? typed : derived,
      unit_price_ttc: priceMode === 'ttc' ? typed : derived,
      price_entry_mode: priceMode,
```

- UI : dans la grille prix, remplacer les deux cellules « Prix TTC » / « Prix HT » par un champ unique + toggle + dérivé grisé :

```tsx
            <div className='col-span-2'>
              <div className='flex items-center justify-between'>
                <Label>Prix ({priceMode === 'ttc' ? 'TTC' : 'HT'}) (€)</Label>
                <div className='flex overflow-hidden rounded-md border text-xs'>
                  {(['ttc', 'ht'] as const).map((m) => (
                    <button
                      key={m}
                      type='button'
                      onClick={() => {
                        if (m === priceMode) return
                        // bascule = conversion : la nouvelle ancre prend la valeur dérivée
                        setPriceInput(String(derived))
                        setPriceMode(m)
                      }}
                      className={cn(
                        'px-2 py-0.5',
                        priceMode === m
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-muted'
                      )}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className='mt-1 flex items-center gap-2'>
                <Input
                  type='number'
                  step='0.01'
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder='0.00'
                />
                <span className='whitespace-nowrap text-xs text-muted-foreground'>
                  {priceMode === 'ttc' ? 'HT' : 'TTC'} : {derived.toFixed(2)} €
                </span>
              </div>
            </div>
```

(ajouter `import { cn } from '@/lib/utils'` si absent ; la grille passe de `grid-cols-3` à `grid-cols-3` avec le champ TVA inchangé dans la 3e colonne).

- [ ] **Step 5: save-to-catalog-dialog — transmettre ancre + mode**

- Étendre `CatalogLine` :

```typescript
type CatalogLine = {
  name: string
  unit_price: number | null
  unit_price_ttc: number | null
  price_entry_mode: string | null
  tva_rate: number | null
  description: string | null
}
```

- Mettre à jour l'appelant dans `quote-editor.tsx` (`onSaveToCatalog` / là où `CatalogLine` est construit depuis l'item) pour passer `unit_price_ttc: item.unit_price_ttc` et `price_entry_mode: item.price_entry_mode`.
- États du dialogue : même pattern toggle que Step 4 (`priceMode` initialisé depuis `line.price_entry_mode ?? 'ttc'`, `priceInput` depuis le PU du mode), dérivé via `deriveUnitHt`/`deriveUnitTtc`.
- Payload produit : `unit_price_ht`, `unit_price_ttc`, `price_entry_mode` comme en Step 4. Payload package : inchangé (`unit_price_ht` seul, dérivé si le mode est ttc).

- [ ] **Step 6: import-products.mjs — ancre TTC explicite**

Dans `scripts/import-products.mjs` (importeur CSV), le payload produit doit écrire l'ancre telle que lue : ajouter `unit_price_ttc` (valeur TTC du CSV) et `price_entry_mode: 'ttc'`, et normaliser le taux via la même règle que `normalizeTvaRate` (un taux dans ]0,1[ est multiplié par 100 — c'est l'importeur qui a créé les 85 produits à `0.2` en mars). Si le script dérive actuellement le HT par floor, remplacer par `round2(ttc / (1 + rate / 100))`.

- [ ] **Step 7: price.ts — supprimer deriveHtFromTtc**

Supprimer la fonction `deriveHtFromTtc` de `src/lib/price.ts` (garder `normalizeTvaRate`). Vérifier qu'il ne reste aucun usage : `grep -rn "deriveHtFromTtc" src/ backend/` → 0 résultat attendu après Steps 4-5 (si d'autres usages apparaissent, les remplacer par `deriveUnitHt` de quote-rounding).

- [ ] **Step 8: Vérifier et commit**

Run: `pnpm build`
Expected: PASS

```bash
git add supabase/migrations/20260707_products_price_anchor.sql src/features/settings/ src/features/reservations/components/save-to-catalog-dialog.tsx src/features/reservations/components/quote-editor.tsx src/lib/price.ts src/lib/supabase/types.ts scripts/import-products.mjs
git commit -m "feat(catalogue): prix stocke verbatim avec toggle ttc/ht et ancre par produit"
```

---

### Task 5: Éditeur — cellules prix contrôlées, toggle par ligne, gardes de comparaison

**Files:**
- Modify: `src/features/reservations/components/quote-editor.tsx` (SortableItemRow l.148-368)

- [ ] **Step 1: Réécrire les cellules prix de SortableItemRow**

Remplacer les deux cellules PU TTC (l.239-260) et PU HT (l.261-277) par : un état contrôlé local, un seul input actif selon `item.price_entry_mode`, la valeur dérivée grisée, un mini-toggle. Ajouter en tête du composant `SortableItemRow` :

```typescript
  const mode = ((item as any).price_entry_mode ?? 'ht') as 'ht' | 'ttc'
  const rate = item.tva_rate ?? 20
  const anchorStored =
    mode === 'ttc'
      ? ((item as any).unit_price_ttc ??
        deriveUnitTtc(item.unit_price ?? 0, rate))
      : (item.unit_price ?? 0)
  const [anchorInput, setAnchorInput] = useState(String(anchorStored))
  useEffect(() => {
    setAnchorInput(String(anchorStored))
    // resynchronise après refetch serveur (id/mode/valeur stockée changés)
  }, [item.id, mode, anchorStored])
  const typedAnchor = parseFloat(anchorInput) || 0
  const derivedUnit =
    mode === 'ttc'
      ? deriveUnitHt(typedAnchor, rate)
      : deriveUnitTtc(typedAnchor, rate)

  // Bascule d'ancre sans changer les montants : la nouvelle ancre reprend le
  // total stocké / qté (4 décimales) pour que le recalcul reproduise le total.
  const handleToggleMode = (newMode: 'ht' | 'ttc') => {
    if (newMode === mode) return
    const qty = item.quantity ?? 1
    const total = newMode === 'ttc' ? item.total_ttc : item.total_ht
    const newAnchor =
      total != null && qty > 0 && !(item.discount_amount ?? 0)
        ? Math.round((total / qty) * 10000) / 10000
        : newMode === 'ttc'
          ? ((item as any).unit_price_ttc ?? derivedUnit)
          : (item.unit_price ?? derivedUnit)
    onUpdateItemFields(item.id, {
      price_entry_mode: newMode,
      ...(newMode === 'ttc'
        ? { unit_price_ttc: newAnchor }
        : { unit_price: newAnchor }),
    } as any)
  }

  const handleAnchorBlur = () => {
    if (Math.abs(typedAnchor - anchorStored) < 0.005) return // garde : rien n'a changé
    onUpdateItemFields(item.id, {
      price_entry_mode: mode,
      ...(mode === 'ttc'
        ? { unit_price_ttc: typedAnchor }
        : { unit_price: typedAnchor }),
    } as any)
  }
```

Les deux `TableCell` prix deviennent (l'ordre des colonnes TTC/HT du tableau est conservé ; la cellule du mode actif porte l'input, l'autre la valeur dérivée grisée) :

```tsx
      <TableCell>
        {mode === 'ttc' ? (
          <Input
            type='number'
            step='0.01'
            value={anchorInput}
            onChange={(e) => setAnchorInput(e.target.value)}
            onBlur={handleAnchorBlur}
            className='h-7 w-20 border-0 p-0 text-xs shadow-none focus-visible:ring-0'
          />
        ) : (
          <button
            type='button'
            title='Saisir en TTC'
            onClick={() => handleToggleMode('ttc')}
            className='text-xs text-muted-foreground italic'
          >
            {derivedUnit.toFixed(2)}
          </button>
        )}
      </TableCell>
      <TableCell>
        {mode === 'ht' ? (
          <Input
            type='number'
            step='0.01'
            value={anchorInput}
            onChange={(e) => setAnchorInput(e.target.value)}
            onBlur={handleAnchorBlur}
            className='h-7 w-20 border-0 p-0 text-xs shadow-none focus-visible:ring-0'
          />
        ) : (
          <button
            type='button'
            title='Saisir en HT'
            onClick={() => handleToggleMode('ht')}
            className='text-xs text-muted-foreground italic'
          >
            {derivedUnit.toFixed(2)}
          </button>
        )}
      </TableCell>
```

(cliquer la valeur grisée bascule l'ancre : c'est le toggle, sans bouton séparé — il matérialise « le champ que je veux saisir fait foi ».)

- [ ] **Step 2: Cellule TVA — Select des taux légaux, ancre conservée**

Remplacer l'Input TVA (l.278-304) par un Select (composants déjà importés) :

```tsx
      <TableCell>
        <Select
          value={String(rate)}
          onValueChange={(v) => {
            const newTva = parseFloat(v)
            if (newTva === rate) return
            onUpdateItemFields(item.id, {
              tva_rate: newTva,
              // l'ancre tient, l'autre côté est re-dérivé par resolveUnitPrices côté hook
            } as any)
          }}
        >
          <SelectTrigger className='h-7 w-16 border-0 p-0 text-xs shadow-none'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 2.1, 5.5, 10, 20].map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r}%
              </SelectItem>
            ))}
            {![0, 2.1, 5.5, 10, 20].includes(rate) && (
              <SelectItem value={String(rate)}>{rate}% (hérité)</SelectItem>
            )}
          </SelectContent>
        </Select>
      </TableCell>
```

(le hook `useUpdateQuoteItem` re-dérive désormais le côté non ancré via `resolveUnitPrices` — plus besoin de passer `unit_price`/`unit_price_ttc` ici ; l'entrée « hérité » permet d'afficher un taux non légal existant sans pouvoir en saisir un nouveau).

- [ ] **Step 3: Remise de ligne — base côté ancre + garde**

Dans la cellule remise (l.305-338), remplacer les deux occurrences de `(item.quantity ?? 1) * (item.unit_price ?? 0)` par une base côté ancre calculée en tête de composant :

```typescript
  const discountBase =
    (item.quantity ?? 1) *
    (mode === 'ttc'
      ? ((item as any).unit_price_ttc ?? 0)
      : (item.unit_price ?? 0))
```

et ajouter la garde d'égalité de pourcentage AVANT le calcul de `newDiscount` :

```typescript
              const currentPct =
                (item.discount_amount ?? 0) > 0 && discountBase > 0
                  ? Math.round(((item.discount_amount ?? 0) / discountBase) * 1000) / 10
                  : 0
              if ((isNaN(pct) ? 0 : pct) === currentPct) return // garde : rien n'a changé
```

- [ ] **Step 4: Vérifier et commit**

Run: `pnpm build`
Expected: PASS

Vérification manuelle (preview) : `pnpm dev`, ouvrir un devis brouillon, vérifier : focus+blur sans saisie ne déclenche aucune requête PATCH (onglet réseau) ; taper un TTC met à jour le HT grisé après l'aller-retour ; cliquer la valeur grisée bascule l'ancre sans changer le Total TTC de la ligne.

```bash
git add src/features/reservations/components/quote-editor.tsx
git commit -m "feat(devis): saisie mono-ancre par ligne avec bascule ttc/ht et gardes anti-mutation"
```

---

### Task 6: Éditeur — insertion catalogue/manuel/package + avertissement devis engagé

**Files:**
- Modify: `src/features/reservations/components/quote-editor.tsx` (handleAddProductFromCatalog l.697-723, handleAddPackageFromCatalog l.726-761, produit manuel l.2115-2142, handleUpdateItemFields l.785-794)

- [ ] **Step 1: handleAddProductFromCatalog — copier l'ancre du produit**

Dans l'appel `addQuoteItem`, remplacer `unitPrice: product.unit_price_ht,` par :

```typescript
          unitPrice: product.unit_price_ht,
          unitPriceTtc: product.unit_price_ttc,
          priceEntryMode:
            ((product as any).price_entry_mode as 'ht' | 'ttc') ?? 'ttc',
```

- [ ] **Step 2: handleAddPackageFromCatalog — mode ht explicite**

Ajouter `priceEntryMode: 'ht',` à l'appel `addQuoteItem` (les packages n'ont pas de prix TTC ; le hook dérivera le cache TTC).

- [ ] **Step 3: Produit manuel — mode ttc par défaut**

Dans le onClick « Produit manuel » (l.2121-2138), remplacer `unitPrice: 0,` par :

```typescript
                                unitPrice: 0,
                                unitPriceTtc: 0,
                                priceEntryMode: 'ttc',
```

- [ ] **Step 4: Avertissement à la première modification d'un devis engagé**

Dans le composant parent (près de `handleUpdateItemFields` l.785) :

```typescript
  // Devis engagé : on ne bloque pas, on confirme une fois par session d'édition.
  const engagedEditConfirmedRef = useRef(false)
  const isEngaged = !!(
    (quoteData as any)?.quote_signed_at ||
    (quoteData as any)?.deposit_paid_at ||
    (quoteData as any)?.balance_paid_at ||
    (quoteData as any)?.external_source
  )
  const confirmEngagedEdit = useCallback(() => {
    if (!isEngaged || engagedEditConfirmedRef.current) return true
    const ok = window.confirm(
      'Ce devis est signé, payé ou importé : modifier les montants changera le total et le solde dû. Continuer ?'
    )
    if (ok) engagedEditConfirmedRef.current = true
    return ok
  }, [isEngaged])
```

et garder les mutations d'items derrière cette confirmation :

```typescript
  const handleUpdateItemFields = useCallback(
    (itemId: string, updates: Partial<QuoteItem>) => {
      if (!quoteId) return
      if (!confirmEngagedEdit()) return
      updateQuoteItem({ id: itemId, quoteId, ...updates } as any, {
        onError: () => toast.error('Erreur lors de la mise à jour'),
      })
    },
    [quoteId, updateQuoteItem, confirmEngagedEdit]
  )
```

Appliquer le même garde `if (!confirmEngagedEdit()) return` en tête de `handleUpdateItem` (mutation champ unique), du handler de suppression d'item, et des trois handlers d'ajout (catalogue, package, manuel). `external_source` doit être présent dans le select de `useQuoteWithItems` — vérifier, sinon l'ajouter.

- [ ] **Step 5: Vérifier et commit**

Run: `pnpm build`
Expected: PASS

Vérification manuelle : insérer « Menu Splash » (39,99 TTC catalogue) sur un devis brouillon de 16 personnes → la ligne affiche PU TTC 39,99 (ancre), Total TTC 639,84, et le total du devis suit.

```bash
git add src/features/reservations/components/quote-editor.tsx
git commit -m "feat(devis): insertion copie l'ancre catalogue et confirmation sur devis engage"
```

---

### Task 7: Preview + PDF — lecture du stocké, PU adaptatif, sous-total sans rétro-dérivation

**Files:**
- Modify: `src/features/reservations/components/quote-editor.tsx` (rawTotals/finalTotals l.878-892)
- Modify: `src/features/reservations/components/quote-preview.tsx` (PU cells ~l.669-673, PU HT)
- Modify: `backend/src/lib/pdf-generator.ts` (PU cell l.888-895, bloc remise l.1242-1303)

- [ ] **Step 1: quote-editor — totaux de preview depuis le stocké**

Remplacer (l.878-884) :

```typescript
  // Totaux affichés = somme des totaux de lignes stockés (parité PDF/DB).
  const rawTotals = sumStoredQuoteTotals(products, 0)
  const finalTotals = sumStoredQuoteTotals(products, discountPercentage)
```

(ajouter `sumStoredQuoteTotals` à l'import depuis la lib ; `computeQuoteAmounts` peut disparaître des imports si plus utilisé). Le reste du bloc (depositAmount, balanceAmount) est inchangé.

- [ ] **Step 2: quote-preview — PU adaptatifs**

Remplacer les rendus de PU : partout où `displayUnitTtc(item)` est formaté avec `formatEuroDecimal`, utiliser `formatUnitPriceEuro`. Pour la colonne PU HT, remplacer le rendu de `item.unit_price` par `formatUnitPriceEuro(displayUnitHt(item))`. Ajouter `displayUnitHt, formatUnitPriceEuro` aux imports de la lib.

- [ ] **Step 3: pdf-generator — PU adaptatif + sous-total avant remise = somme des lignes**

- Cellule PU (l.889) : `formatEuroDecimal(displayUnitTtc(item))` → `formatUnitPriceEuro(displayUnitTtc(item))` (3 sites : devis, acompte, solde — importer `formatUnitPriceEuro` l.8-12). Idem cellule PU HT si présente : `formatUnitPriceEuro(displayUnitHt(item))`.
- Bloc remise (l.1244-1245) : remplacer la rétro-dérivation par la somme des lignes :

```typescript
      const productLines = items.filter((i: any) => i.item_type !== 'extra')
      const rawHt = round2(
        productLines.reduce((s: number, i: any) => s + (i.total_ht || 0), 0)
      )
      const discountAmount = round2(rawHt - quote.total_ht)
```

(importer `round2` depuis `./quote-rounding.js` ; `items` est la liste des lignes déjà disponible dans le scope du générateur — utiliser la variable réellement en scope à cet endroit). Faire le même remplacement pour le `rawTtc` de l'acompte (l.1387 et l.1414) avec `total_ttc`.

- [ ] **Step 4: Vérifier et commit**

Run: `pnpm build && cd backend && pnpm build && pnpm test`
Expected: PASS

Vérification manuelle : sur un devis BS historique (ligne 3 × 29,17 → 87,50), la preview affiche PU HT « 29,1667 € » et Total HT 87,50 — le produit colle. Le PDF téléchargé affiche les mêmes montants que la preview.

```bash
git add src/features/reservations/components/ backend/src/lib/pdf-generator.ts
git commit -m "feat(devis): preview et pdf lisent le stocke, pu adaptatif 4 decimales"
```

---

### Task 8: Backend — recalcul somme des stockés, whitelist quotes, round2 solde

**Files:**
- Modify: `backend/src/routes/quotes.ts` (POST l.140-165, PATCH l.168-183, recalculateQuoteTotals l.1231-1261, send-balance l.715-728)

- [ ] **Step 1: recalculateQuoteTotals backend — somme des stockés**

Même remplacement que Task 3 Step 4 (corps identique, `sumStoredQuoteTotals` importé depuis `../lib/quote-rounding.js` à la place de `computeQuoteAmounts` si celui-ci n'a plus d'usage dans le fichier).

- [ ] **Step 2: Whitelist des totaux sur POST / et PATCH /:id**

En tête des deux handlers, avant tout usage de `req.body` :

```typescript
    // Les totaux sont calculés serveur (somme des lignes) : jamais acceptés du client.
    const { total_ht, total_tva, total_ttc, ...body } = req.body
```

utiliser `body` à la place de `req.body` dans l'insert/update. Dans PATCH uniquement, après l'update réussi :

```typescript
    if ('discount_percentage' in body) {
      await recalculateQuoteTotals(req.params.id)
    }
```

- [ ] **Step 3: send-balance — round2**

Remplacer (l.727-728) :

```typescript
    const depositTtc = quoteDepositTtc(quoteData as any)
    const balanceAmount = round2(totalWithExtrasTtc - depositTtc)
```

(importer `round2` ; supprimer le commentaire obsolète « Tous les montants sont des entiers » l.716).

- [ ] **Step 4: Vérifier et commit**

Run: `cd backend && pnpm build && pnpm test`
Expected: PASS

```bash
git add backend/src/routes/quotes.ts
git commit -m "fix(api): totaux devis jamais acceptes du client, recalc remise, solde au centime"
```

---

### Task 9: Scripts data — ré-ancrage ciblé + recette lecture seule

**Files:**
- Create: `scripts/booking_shake_import/anchor_fix_targeted.py`
- Create: `scripts/booking_shake_import/recette_ancre.py`

- [ ] **Step 1: Script ciblé (dry-run par défaut, --apply avec snapshot)**

Suivre le pattern exact de `backfill_unit_price_ttc.py` (docstring, `round2` copie du TS, dry-run défaut, snapshot `backups/anchor_fix_snapshot_<ts>.json` avant écriture). Périmètre :

(a) Lignes `unit_price_ttc IS NULL` de devis en statut `draft` uniquement : joindre quote → booking (`booking_id`) → `restaurant_id`, chercher dans `products` (via `product_restaurants`) un produit actif de même `name` exact pour ce restaurant. Si trouvé : `price_entry_mode='ttc'`, `unit_price_ttc=product.unit_price_ttc`, `unit_price=product.unit_price_ht`, `total_ttc=round2(qty*unit_price_ttc - discount)`, `total_ht=round2(total_ttc/(1+tva/100))`, puis header = somme des totaux stockés des lignes produits × (1−remise). Sans correspondance produit : lister, ne pas toucher.

(b) Lignes `price_entry_mode='ttc' AND discount_amount > 0` dont `total_ttc != round2(qty*unit_price_ttc - discount)` (les 4 connues) : recalculer `total_ttc/total_ht` selon la règle (a) + header.

Le dry-run imprime chaque ligne candidate (id devis, numéro, nom ligne, avant → après) et attend une validation humaine avant `--apply`.

- [ ] **Step 2: Script de recette (lecture seule stricte, aucun patch)**

`recette_ancre.py` imprime, ventilé par `external_source` et `price_entry_mode` :
1. lignes où `round2(qty × PU_ancre − remise) != total_ancré` (tolérance 0,005) — PU_ancre = `unit_price_ttc` si mode ttc sinon `unit_price` ;
2. devis où `total_ttc != round2(round2(Σ total_ttc lignes produits) × (1−remise%/100))` — avec la liste nominative des ~30 BS connus (id, numéro, stocké, somme) pour arbitrage manuel ;
3. compte des lignes dont le PU exact (total/qté) demande >2 décimales (population « PU adaptatif ») ;
4. compte des lignes à taux non légal (rappel du chantier TVA différé).

- [ ] **Step 3: Exécuter la recette AVANT toute application (baseline)**

Run: `python3 scripts/booking_shake_import/recette_ancre.py`
Expected: chiffres cohérents avec l'audit du 06/07 (≈7 973 lignes non round-trip, ≈67 headers désync dont ~30 BS, 646 PU >2 déc, 398 taux non légaux). Conserver la sortie (baseline avant déploiement).

- [ ] **Step 4: Commit (scripts seuls, pas d'application)**

```bash
git add scripts/booking_shake_import/anchor_fix_targeted.py scripts/booking_shake_import/recette_ancre.py
git commit -m "chore(scripts): re-ancrage cible des brouillons et recette ancre unique"
```

L'application de `anchor_fix_targeted.py --apply` se fait APRÈS le déploiement front/back, sur validation explicite de l'utilisateur, dry-run montré d'abord.

---

### Task 10: Vérifications finales

**Files:** aucun nouveau — build, tests, lint, recette.

- [ ] **Step 1: Suite complète**

Run: `pnpm build && pnpm lint && cd backend && pnpm build && pnpm test`
Expected: tout PASS, 0 nouveau warning lint.

- [ ] **Step 2: Parité des deux libs**

Run: `diff <(grep -v '^//' src/features/reservations/lib/quote-rounding.ts) <(grep -v '^//' backend/src/lib/quote-rounding.ts)`
Expected: vide.

- [ ] **Step 3: Scénario bout en bout (preview)**

Sur un devis brouillon de test : insérer Menu Splash (16 pers.) → total 639,84 partout (éditeur, preview) ; focus+blur des champs prix → aucune requête réseau ; bascule TTC→HT→TTC → totaux inchangés ; remise globale 10 % + Enregistrer → totaux stockés mis à jour (vérifier le PATCH) ; devis BS : ouvrir, ne rien toucher, fermer → aucune écriture.

- [ ] **Step 4: Commit final éventuel + récapitulatif**

Si des ajustements sont sortis des vérifications, les committer. Produire le récapitulatif : commits de la branche, sortie de la recette baseline, points en attente (application du script ciblé post-déploiement, arbitrage des ~30 headers BS).
