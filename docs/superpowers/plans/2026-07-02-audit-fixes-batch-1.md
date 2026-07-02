# Audit fixes — lot 1 (items 1/2/4/9/11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 5 premiers constats de l'audit du 2026-07-02 : verrou de la RPC d'avoir (sécurité prod), commit du fix des notifications commerciales, avoir/remise partiels sur lignes verbatim (correction fiscale), gel de l'acompte sur tous les chemins de paiement, et régénération des types Supabase.

**Architecture :** 5 tâches quasi indépendantes, ordonnées par dépendance. Une seule branche `fix/audit-batch-1` depuis `main`, un commit par tâche. Deux tâches demandent une action hors-code de Thomas : appliquer la migration T1 dans l'éditeur SQL prod, et `supabase login` avant T5.

**Tech Stack :** Supabase (Postgres + PostgREST), Express 4 (backend, service-role), Vite/React 19/TS, vitest (tests backend uniquement — pas d'infra de test frontend dans ce repo).

**Contexte prod vérifié le 2026-07-02 (lecture seule) :** 1 seule organisation (18 users), 1 seul avoir émis (AV-2026-0001, crédit total, sain — aucune reprise de données), exploit RPC confirmé empiriquement via la clé anon. Ces fixes ne réparent pas de données existantes, ils ferment des fenêtres ouvertes.

**Hors périmètre (lot 2, plus tard) :** items 3 (org-scoping des endpoints avoir), 5 (preview lit les totaux stockés), 6 (PDF `unit_price_ttc`), 7 (`formatEuroWhole` → adaptatif), 8/récap trop-perçu double comptage, 10 (pagination contacts). Le durcissement « defense in depth » de la RPC (gardes internes) est rattaché à l'item 3 et suit ce lot.

---

## File Structure

| Tâche | Fichiers | Responsabilité |
|---|---|---|
| T1 REVOKE RPC | `supabase/migrations/20260702_credit_note_rpc_grants.sql` (create) | Retirer EXECUTE à anon/authenticated/public sur `create_credit_note`, ne laisser que service_role |
| T2 notifications | `backend/src/lib/commercial-notifications.ts`, `backend/src/routes/payments.ts`, `backend/src/routes/bookings.ts` (modify) | Lire `assigned_user_ids` après le drop de `bookings.assigned_to` |
| T4 verbatim | `backend/src/lib/quote-rounding.ts`, `src/features/reservations/lib/quote-rounding.ts` (modify), `backend/tests/quote-rounding.test.ts`, `backend/tests/credit-note.test.ts` (modify) | Remise + avoir partiels corrects sur lignes verbatim (baisse TTC au prorata du ratio réel) |
| T9 gel acompte | `src/features/reservations/hooks/use-bookings.ts`, `src/features/reservations/components/quote-editor.tsx` (modify) | Figer l'acompte sur le flux virement + ne pas l'effacer par sauvegarde en mode % |
| T5 types | `src/lib/supabase/types.ts` (regen), `src/features/reservations/hooks/use-quotes.ts`, `docs/DATABASE.md` (modify) | Régénérer les types, retirer les casts `as any` de la chaîne avoir |

**Ordre imposé :** T2 en premier (purge le working tree des 2 fichiers backend déjà modifiés) → T1 (migration, indépendante) → T4 → T9 → T5 en dernier (régénère `types.ts` et remanie `use-quotes.ts`, zones chaudes des autres tâches).

---

## Task 0 : Préparer la branche

**Files:** aucun (git).

- [ ] **Step 1: Créer la branche depuis main, en emmenant les modifs non commitées**

Les changements non commités (dont le fix notifications) suivent la branche.

Run:
```bash
cd /Users/thomas/Desktop/WINDSURF/restaurant-crm
git switch -c fix/audit-batch-1
git status --short
```
Expected: la branche `fix/audit-batch-1` est active ; `git status` liste toujours `M backend/src/lib/commercial-notifications.ts`, `M backend/src/routes/payments.ts`, etc.

---

## Task 1 : Verrou EXECUTE sur la RPC create_credit_note

**Files:**
- Create: `supabase/migrations/20260702_credit_note_rpc_grants.sql`

Migration seule, aucun code applicatif. Le seul appelant légitime est le backend en service-role ([backend/src/routes/quotes.ts:1422](backend/src/routes/quotes.ts:1422)) ; le frontend n'appelle jamais ce RPC. Le REVOKE ne casse donc aucun flux. On se limite au REVOKE/GRANT (ferme le trou externe exploitable via la clé anon) ; les gardes internes « defense in depth » sont rattachés à l'item 3 (org-scoping) du lot 2.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/20260702_credit_note_rpc_grants.sql` :
```sql
-- create_credit_note est SECURITY DEFINER (bypasse la RLS) et Postgres accorde
-- EXECUTE a PUBLIC par defaut : la fonction etait donc appelable via
-- POST /rest/v1/rpc/create_credit_note avec la cle anon, permettant une ecriture
-- cross-org (update quotes / delete quote_items). On retire EXECUTE a tout le monde
-- sauf service_role (le backend l'appelle en service-role).
-- Signature complete requise pour cibler la bonne fonction.

revoke execute on function public.create_credit_note(
  uuid, uuid, uuid, uuid, text,
  numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric,
  uuid[], jsonb, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.create_credit_note(
  uuid, uuid, uuid, uuid, text,
  numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric,
  uuid[], jsonb, jsonb, uuid
) to service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260702_credit_note_rpc_grants.sql
git commit -m "fix(avoir): revoke execute sur create_credit_note pour anon/authenticated"
```

- [ ] **Step 3: Appliquer en prod (action Thomas, éditeur SQL)**

Coller le contenu du fichier dans l'éditeur SQL du projet prod (`geofmvmydyjuculbbmil`), comme les migrations précédentes. Pas de `notify pgrst` nécessaire (les privilèges sont évalués à l'exécution).

- [ ] **Step 4: Vérifier que le trou est fermé**

Depuis le repo, rejouer la sonde anon (elle doit désormais renvoyer 403, plus 409/23503) :
```bash
ANON=$(grep '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-) && URL=$(grep '^VITE_SUPABASE_URL=' .env.local | cut -d= -f2-) && curl -s -o /dev/null -w '%{http_code}\n' "$URL/rest/v1/rpc/create_credit_note" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{}'
```
Expected: `403` (avant le fix : `404`/`400`/`409` selon le corps — la fonction était atteignable).

- [ ] **Step 5: Vérifier que le backend fonctionne toujours**

Émettre un avoir de test depuis l'UI en local (bouton avoir sur un devis) : le POST `/api/quotes/:id/credit-note` doit réussir (le backend utilise la clé service-role, conservée par le GRANT).

---

## Task 2 : Fix des notifications commerciales (working tree → commit propre)

**Files:**
- Modify: `backend/src/lib/commercial-notifications.ts` (fix déjà présent dans le working tree)
- Modify: `backend/src/routes/payments.ts` (fix fonctionnel présent + reformatage prettier à isoler)
- Modify: `backend/src/routes/bookings.ts:26,33,59` (pas encore corrigé)

Cause racine : la colonne `bookings.assigned_to` a été droppée par `20260420_drop_bookings_assigned_to.sql` ; le backend la lit encore → erreur 42703, notifications signature/paiement mortes depuis avril. Le working tree contient déjà le fix pour `commercial-notifications.ts` et `payments.ts` (mêlé à ~150 lignes de reformatage prettier). `bookings.ts` n'est pas encore corrigé.

- [ ] **Step 1: Corriger l'embed FK droppée dans bookings.ts**

Dans `backend/src/routes/bookings.ts`, GET `/` (~ligne 20-33) : retirer la ligne d'embed et remplacer le filtre.

Remplacer :
```
        time_slot:time_slots (id, name, start_time, end_time),
        assigned_user:users!bookings_assigned_to_fkey (id, first_name, last_name)
      `)
```
par :
```
        time_slot:time_slots (id, name, start_time, end_time)
      `)
```
Et remplacer :
```
    if (assignedTo) query = query.eq('assigned_to', assignedTo)
```
par :
```
    if (assignedTo) query = query.contains('assigned_user_ids', [assignedTo])
```

Dans GET `/:id` (~ligne 59), retirer :
```
        assigned_user:users!bookings_assigned_to_fkey (id, first_name, last_name, email),
```
(supprimer la ligne entière, y compris la virgule de fin).

- [ ] **Step 2: Vérifier que le backend compile avec le working tree complet**

Run:
```bash
cd backend && pnpm exec tsc --noEmit && cd ..
```
Expected: 0 erreur.

- [ ] **Step 3: Commit ciblé du fix fonctionnel (jamais `git add -A`)**

Le working tree contient d'autres modifs sans rapport (`.gitignore`, `.claude/launch.json`, `scripts/import-products.mjs`, `supabase/.temp/`). `git add` uniquement les 3 fichiers backend.

```bash
git add backend/src/lib/commercial-notifications.ts backend/src/routes/payments.ts backend/src/routes/bookings.ts
git commit -m "fix(notifications): lire assigned_user_ids apres le drop de bookings.assigned_to"
```

Note : le diff de `payments.ts`/`commercial-notifications.ts` inclut le reformatage prettier du format-on-save (l'éditeur l'a produit ; `.prettierignore` exclut `backend/`, aucun hook git). Il n'y a qu'un seul changement fonctionnel dans `payments.ts` (`assigned_user_ids?.[0]` au lieu de `assigned_to`, lignes 286-291). Isoler le reformatage n'apporte rien de mesurable ici ; l'accepter dans le même commit est le choix pragmatique (le documenter dans le corps du commit si tu veux, sinon rien).

- [ ] **Step 4: Vérification post-commit**

```bash
git status --short
```
Expected: les 3 fichiers backend ne sont plus listés ; les autres modifs non liées restent.

Risque connu : après déploiement backend (Render), les notifs signature/paiement repartent immédiatement. Pas de rattrapage rétroactif (call sites event-driven, pas de backlog). **Ne pas rejouer d'anciens webhooks Stripe depuis le dashboard** (ils enverraient des notifs périmées). Prévenir les commerciaux que les mails reviennent.

---

## Task 4 : Avoir + remise partiels corrects sur lignes verbatim

**Files:**
- Modify: `backend/src/lib/quote-rounding.ts:129-133` (branche verbatim de `computeLineAmounts`) et `:244-245` (`applyLineCredit`)
- Modify: `src/features/reservations/lib/quote-rounding.ts:147-151` et `:272-277` (copie iso, doit rester identique en logique)
- Test: `backend/tests/quote-rounding.test.ts` (mettre à jour le test de remise verbatim + ajouter un cas ratio)
- Test: `backend/tests/credit-note.test.ts` (ajouter un cas d'avoir partiel sur ligne verbatim)

Bug : `applyLineCredit` a été écrit avant la branche verbatim ; il convertit le crédit TTC en remise HT (`creditedTtc / mult`) en comptant sur l'ancienne re-dérivation, mais la branche verbatim soustrait le même `discount_amount` des deux côtés → crédit sous-évalué en mode 'ht', TVA d'avoir à 0. Fix : `discount_amount` reste un scalaire ancré HT, et la branche verbatim fait baisser le TTC au prorata du ratio réel `PU_TTC/PU_HT` de la ligne (les PU saisis font foi). Pas de migration. Les deux copies front/back doivent rester identiques et partir dans le même déploiement.

- [ ] **Step 1: Mettre à jour le test de remise verbatim (il encode l'ancien comportement bugué)**

Dans `backend/tests/quote-rounding.test.ts`, le test « remise soustraite des deux cotes » (lignes 134-144) attend `totalTtc === 100` pour une remise HT de 20 sur une ligne HT100/TTC120 — c'est le comportement qu'on corrige. Le remplacer par :

```ts
  it('remise ancree HT, baisse TTC au prorata du ratio reel de la ligne', () => {
    const l = computeLineAmounts({
      quantity: 1,
      unit_price: 100,
      unit_price_ttc: 120,
      discount_amount: 20,
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(80) // 100 - 20
    expect(l.totalTtc).toBe(96) // 120 - 20*(120/100)
    expect(l.totalTva).toBe(16)
  })
```

- [ ] **Step 2: Ajouter le test qui aurait attrapé le bug d'avoir (dans credit-note.test.ts)**

Dans `backend/tests/credit-note.test.ts`, ajouter ce bloc à la fin (les fixtures existantes n'ont qu'un seul PU, donc n'exercent jamais la branche verbatim) :

```ts
describe('avoir partiel sur ligne verbatim (les deux PU saisis)', () => {
  const VERBATIM = [
    {
      id: 'v1',
      quantity: 1,
      unit_price: 100,
      unit_price_ttc: 120,
      tva_rate: 20,
      item_type: 'product',
    },
  ]
  it('credit 12 TTC -> avoir 12 TTC / 10 HT / 2 TVA (pas de TVA a 0)', () => {
    const r = computeCreditNote(VERBATIM, { v1: 12 }, 0, 0)
    expect(r.avoirTtc).toBe(12)
    expect(r.avoirHt).toBe(10)
    expect(r.avoirTva).toBe(2)
    expect(r.newEffectiveTtc).toBe(108)
  })
})
```

- [ ] **Step 3: Lancer les tests, vérifier qu'ils échouent**

Run:
```bash
cd backend && pnpm exec vitest run tests/quote-rounding.test.ts tests/credit-note.test.ts && cd ..
```
Expected: FAIL — `totalTtc` vaut 100 (attendu 96) et `avoirTva` vaut 0 (attendu 2).

- [ ] **Step 4: Corriger la branche verbatim de computeLineAmounts (backend)**

Dans `backend/src/lib/quote-rounding.ts`, remplacer les lignes 129-133 :
```ts
  if (input.unit_price != null && input.unit_price_ttc != null) {
    const totalHt = round2(qty * input.unit_price - discount)
    const totalTtc = round2(qty * input.unit_price_ttc - discount)
    return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
  }
```
par :
```ts
  if (input.unit_price != null && input.unit_price_ttc != null) {
    const grossHt = qty * input.unit_price
    const grossTtc = qty * input.unit_price_ttc
    // Remise ancree HT (l'editeur et le PDF la derivent du HT) ; la baisse TTC suit
    // le ratio reel de la ligne, pas tva_rate (verbatim : les PU saisis font foi).
    const totalHt = round2(grossHt - discount)
    const totalTtc = round2(
      grossTtc - (grossHt > 0 ? discount * (grossTtc / grossHt) : discount)
    )
    return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
  }
```

- [ ] **Step 5: Corriger applyLineCredit (backend)**

Dans `backend/src/lib/quote-rounding.ts`, remplacer les lignes 244-245 :
```ts
  const addDiscount =
    line.price_entry_mode === 'ttc' ? creditedTtc : rate <= -100 ? 0 : creditedTtc / mult
```
par :
```ts
  const addDiscount =
    line.unit_price != null && line.unit_price_ttc != null
      ? line.unit_price_ttc > 0
        ? creditedTtc * (line.unit_price / line.unit_price_ttc)
        : 0
      : line.price_entry_mode === 'ttc'
        ? creditedTtc
        : rate <= -100
          ? 0
          : creditedTtc / mult
```

- [ ] **Step 6: Répliquer les deux changements dans la copie frontend**

Dans `src/features/reservations/lib/quote-rounding.ts`, appliquer le MÊME changement de computeLineAmounts (lignes 147-151, texte identique au Step 4) et de applyLineCredit (lignes 272-277, texte identique au Step 5). Les deux fichiers doivent rester logiquement identiques (invariant du repo, en-tête du fichier backend).

- [ ] **Step 7: Lancer les tests, vérifier qu'ils passent**

Run:
```bash
cd backend && pnpm exec vitest run tests/quote-rounding.test.ts tests/credit-note.test.ts && cd ..
```
Expected: PASS (tous), y compris les tests verbatim existants (`totalTtc === 25`, legacy HT).

- [ ] **Step 8: Vérifier que le front compile**

Run:
```bash
pnpm exec tsc -b
```
Expected: 0 erreur.

- [ ] **Step 9: Commit**

```bash
git add backend/src/lib/quote-rounding.ts src/features/reservations/lib/quote-rounding.ts backend/tests/quote-rounding.test.ts backend/tests/credit-note.test.ts
git commit -m "fix(avoir): credit et remise partiels corrects sur lignes verbatim"
```

Risque : ce fix change la sémantique de TOUTES les remises par ligne sur lignes verbatim (pas que l'avoir). En prod : 1 seule ligne concernée (devis PODIUM brouillon, 0 paiement), le nouveau comportement correspond à l'intention. Déployer back + front ensemble ; éviter d'émettre un avoir entre les deux déploiements.

---

## Task 9 : Gel de l'acompte sur tous les chemins de paiement

**Files:**
- Modify: `src/features/reservations/hooks/use-bookings.ts:1019-1027` (`useUpdatePayment`, ajouter le gel)
- Modify: `src/features/reservations/components/quote-editor.tsx:495` (ref), `:498-517` (reset dans l'init), `:620-623` (saveAllFields), `:1194-1196` et `:1208-1210` (toggles)

Pas d'infra de test frontend dans ce repo → vérification par `tsc` + contrôle manuel. Deux trous : (1) le flux virement (`useUpdatePayment`) ne fige jamais `deposit_amount_override` ; (2) `saveAllFields` écrit `null` dès que le mode est `%`, ce qui peut effacer un gel posé par le webhook.

- [ ] **Step 1: FIX 1 — figer l'acompte dans useUpdatePayment**

Dans `src/features/reservations/hooks/use-bookings.ts`, dans la branche acompte de `useUpdatePayment`, après le bloc `if (resolvedQuoteId) { ... }` qui se termine ligne 1027, insérer (à l'intérieur du même `if (resolvedQuoteId)`, juste après l'update de statut) le gel — copie du comportement de `useCreatePayment` (lignes 858-864) :

Remplacer les lignes 1019-1027 :
```ts
          // Update quote status to deposit_paid
          if (resolvedQuoteId) {
            await supabase
              .from('quotes')
              .update({
                status: 'deposit_paid',
                deposit_paid_at: new Date().toISOString(),
              })
              .eq('id', resolvedQuoteId)
          }
```
par :
```ts
          // Update quote status to deposit_paid
          if (resolvedQuoteId) {
            await supabase
              .from('quotes')
              .update({
                status: 'deposit_paid',
                deposit_paid_at: new Date().toISOString(),
              })
              .eq('id', resolvedQuoteId)

            // Fige l'acompte en euros au montant encaisse (si pas deja fige), pour qu'il ne se
            // recalcule plus en % si le total du devis change ensuite.
            await supabase
              .from('quotes')
              .update({ deposit_amount_override: payment.amount } as never)
              .eq('id', resolvedQuoteId)
              .is('deposit_amount_override', null)
          }
```
(`payment` est la row post-update disponible ligne 988 ; `payment.amount` est le montant final.)

- [ ] **Step 2: FIX 2a — ajouter un ref « mode d'acompte touché dans cette session »**

Dans `src/features/reservations/components/quote-editor.tsx`, après la ligne 495 (`const replacedPlaceholdersRef = useRef<string | null>(null)`), ajouter :
```ts
  // L'utilisateur a-t-il explicitement bascule le mode d'acompte dans cette session ?
  // Sinon on ne reecrit pas deposit_amount_override (pour ne pas effacer un gel serveur).
  const depositModeTouchedRef = useRef(false)
```

- [ ] **Step 3: FIX 2b — remettre le ref à false quand l'init recharge depuis la DB**

Dans le `useEffect` d'init (lignes 498-517), dans le bloc `if (quoteData) {`, après `setDiscountPercentage(...)` (ligne 506) et avant le `if ((quoteData as any).deposit_amount_override != null)`, ajouter :
```ts
      depositModeTouchedRef.current = false
```

- [ ] **Step 4: FIX 2c — marquer le ref sur les deux toggles**

Dans le toggle `%` (lignes 1194-1196), remplacer :
```ts
                                      onClick={() =>
                                        dirty(setDepositMode)('percentage')
                                      }
```
par :
```ts
                                      onClick={() => {
                                        depositModeTouchedRef.current = true
                                        dirty(setDepositMode)('percentage')
                                      }}
```
Dans le toggle `€` (lignes 1208-1210), remplacer :
```ts
                                      onClick={() =>
                                        dirty(setDepositMode)('amount')
                                      }
```
par :
```ts
                                      onClick={() => {
                                        depositModeTouchedRef.current = true
                                        dirty(setDepositMode)('amount')
                                      }}
```

- [ ] **Step 5: FIX 2d — ne réécrire deposit_amount_override que si le mode a été touché**

Dans `saveAllFields`, remplacer les lignes 618-623 :
```ts
        deposit_percentage:
          depositMode === 'percentage' ? depositPercentage : 0,
        deposit_amount_override:
          depositMode === 'amount'
            ? parseFloat(depositAmountOverride) || 0
            : null,
```
par :
```ts
        deposit_percentage:
          depositMode === 'percentage' ? depositPercentage : 0,
        ...(depositMode === 'amount'
          ? { deposit_amount_override: parseFloat(depositAmountOverride) || 0 }
          : depositModeTouchedRef.current
            ? { deposit_amount_override: null }
            : {}),
```
(En mode % non touché, la clé est omise : l'update Supabase ignore les clés absentes, donc un gel serveur survit. `deposit_percentage` reste écrit mais l'override prime partout à l'affichage.)

- [ ] **Step 6: Vérifier la compilation**

Run:
```bash
pnpm exec tsc -b
```
Expected: 0 erreur.

- [ ] **Step 7: Contrôle manuel (pas d'infra de test frontend)**

Sur un devis local en mode % : payer un acompte par virement (créer paiement pending puis passer « payé ») → vérifier en base que `deposit_amount_override` est renseigné au montant payé. Rééditer le total du devis → l'acompte affiché ne bouge plus. Puis basculer explicitement le toggle sur % et enregistrer → l'override redevient null (retour en % volontaire préservé).

- [ ] **Step 8: Commit**

```bash
git add src/features/reservations/hooks/use-bookings.ts src/features/reservations/components/quote-editor.tsx
git commit -m "fix(devis): fige l'acompte au paiement virement et ne l'efface plus par sauvegarde en %"
```

Note : backfill prod optionnel des devis `deposit_paid` à override null — à décider après diagnostic, hors de ce commit. Ne pas backfiller l'historique ni le stock Booking Shake.

---

## Task 5 : Régénérer les types Supabase (EN DERNIER)

**Files:**
- Regen: `src/lib/supabase/types.ts` (2816 lignes, dernière vraie régénération : mai)
- Modify: `src/features/reservations/hooks/use-quotes.ts` (retirer `from('credit_notes' as any)` et les interfaces locales dupliquées)
- Modify: `docs/DATABASE.md:74` (commande de régénération fausse)

**Bloqueur :** la CLI Supabase n'est pas authentifiée. Thomas doit faire `supabase login` (ou exporter `SUPABASE_ACCESS_TOKEN`) avant le Step 2. À faire en dernier car ça régénère `types.ts` et remanie `use-quotes.ts` (zones chaudes de T4/T9). Baseline `tsc` verte aujourd'hui → toute erreur post-regen est imputable à la regen et se trie une par une, **jamais en ré-éditant `types.ts` à la main**.

- [ ] **Step 1: Sauvegarder le bloc de convenience types (sera écrasé par la regen)**

Les lignes 2756-2816 de `src/lib/supabase/types.ts` (`// Convenience types` jusqu'à `UserWithRelations`) ne sont pas générées par la CLI et sont importées par ~25 fichiers. Les sauver :
```bash
sed -n '2756,2816p' src/lib/supabase/types.ts > /tmp/types-convenience-tail.ts
wc -l /tmp/types-convenience-tail.ts
```
Expected: ~61 lignes.

- [ ] **Step 2: Régénérer contre la prod (après `supabase login`)**

La prod est la source de vérité (migrations collées via l'éditeur SQL).
```bash
supabase gen types typescript --project-id geofmvmydyjuculbbmil > src/lib/supabase/types.ts
```
Puis ré-appender le bloc de convenience :
```bash
printf '\n' >> src/lib/supabase/types.ts && cat /tmp/types-convenience-tail.ts >> src/lib/supabase/types.ts
```

- [ ] **Step 3: Contrôler le diff attendu**

```bash
grep -c "credit_notes\|credit_note_items\|document_counters\|create_credit_note\|search_contacts" src/lib/supabase/types.ts
git diff --stat src/lib/supabase/types.ts
```
Expected: le grep retourne > 0 (les nouvelles tables/RPC sont là) ; le diff reflète toutes les migrations depuis mai. Toute ligne inattendue = drift prod/migrations locales → **à documenter dans le message de commit, pas à masquer**. Si une RPC attendue manque (ex. un collage prod jamais fait), garder le cast au call site concerné et le noter.

- [ ] **Step 4: Retirer les casts de la chaîne avoir dans use-quotes.ts**

Dans `src/features/reservations/hooks/use-quotes.ts` : remplacer les interfaces locales `CreditNote`/`CreditNoteItem` par `Tables<'credit_notes'>` / `Tables<'credit_note_items'>`, retirer `.from('credit_notes' as any)` → `.from('credit_notes')` (si l'inférence de l'embed `credit_note_items(*)` coince, utiliser `.returns<CreditNote[]>()` plutôt que `as any`), et retirer le `as any` sur `rpc('create_credit_note', ...)`. Ne pas toucher les autres `as any` historiques hors périmètre avoir (autre chantier).

- [ ] **Step 5: Corriger la commande dans DATABASE.md**

Dans `docs/DATABASE.md`, remplacer la ligne 74 :
```
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```
par :
```
supabase gen types typescript --project-id geofmvmydyjuculbbmil > src/lib/supabase/types.ts
# puis re-appender le bloc "Convenience types" en fin de fichier (non genere par la CLI)
```

- [ ] **Step 6: Vérifier build + lint**

Run:
```bash
pnpm exec tsc -b && pnpm lint
cd backend && pnpm exec tsc --noEmit && cd ..
```
Expected: `tsc` 0 erreur des deux côtés. Le lint peut rester rouge (dette préexistante massive) mais ne doit pas ajouter d'erreurs `no-explicit-any` sur les call sites nettoyés.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/types.ts src/features/reservations/hooks/use-quotes.ts docs/DATABASE.md
git commit -m "chore(types): regenere les types supabase et retire les casts de la chaine avoir"
```

---

## Self-Review

- **Couverture :** items 1 (T1), 2 (T2), 4 (T4), 9 (T9), 11 (T5) — les 5 demandés, chacun avec sa tâche.
- **Ordre/dépendances :** T2 avant les autres tâches backend (purge le working tree) ; T5 en dernier (touche `use-quotes.ts` et `types.ts`). T1 indépendante. T4 et T9 sans interaction (fichiers disjoints après T2).
- **Cohérence de types :** `applyLineCredit` et `computeLineAmounts` gardent leurs signatures ; le champ `discount_amount` reste un scalaire (aucune migration, RPC inchangé). `payment.amount` (T9) existe bien sur la row retournée.
- **Pas de placeholder :** chaque step de code montre le code réel avant/après ; les deux actions hors-code (apply SQL prod T1, `supabase login` T5) sont explicitement marquées comme dépendances Thomas.
- **Point d'attention T4 :** un test existant (`quote-rounding.test.ts`) encode l'ancien comportement et est réécrit au Step 1 — c'est intentionnel, la sémantique de la remise verbatim change.
