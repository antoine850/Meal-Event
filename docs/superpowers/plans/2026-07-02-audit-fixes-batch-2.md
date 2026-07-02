# Audit fixes — lot 2 (items 5/6/7/8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Corriger les 4 constats d'affichage/calcul restants de l'audit : trop-perçu qui ignore le solde (item 5), preview qui recalcule au lieu de lire le stocké (item 6), PDF qui re-dérive le PU TTC (item 7), et `formatEuroWhole` qui arrondit à l'euro des montants au centime (item 8).

**Architecture :** 4 tâches indépendantes sur la branche `fix/audit-batch-2` depuis `main`. Un commit par tâche. Ordre 5 → 6 → 7 → 8 : l'item 8 est un balayage de format transversal, fait en dernier pour qu'il s'applique par-dessus les changements des autres. Aucune migration, aucune reprise de données.

**Tech Stack :** Express 4 (backend), pdfmake, Vite/React 19/TS, vitest (backend uniquement).

**Décisions tranchées (défauts documentés) :**
- Item 5 : « encaissé » = tous les paiements `paid/completed` (acompte + solde + extra + caution), la convention déjà appliquée par le récap solde / `getRemainingBalance` / la facture de solde. 0 caution en prod aujourd'hui ; exclure la caution serait une décision app-wide séparée.
- Item 8 : on NE régénère PAS les PDF déjà envoyés/archivés (le montant stocké fait foi). Le fix ne change que le rendu des futurs affichages/documents.

**Contexte prod :** 1 org, 1 avoir émis (sain). Le lot 1 (verbatim, gel acompte, REVOKE, notifications, types) est déjà sur `main`. `formatEuroWhole` n'existe que dans 7 fichiers source (les autres correspondances sont dans `backend/dist/`, build compilé, à ignorer).

---

## File Structure

| Tâche | Fichiers | Responsabilité |
|---|---|---|
| T5 trop-perçu | `backend/src/routes/quotes.ts`, `src/features/reservations/components/booking-detail.tsx` | Calcul du trop-perçu sur tout l'encaissé (back) + récap sans double comptage (front) |
| T6 preview stocké | `src/features/reservations/components/quote-preview.tsx` | Lire `item.total_ht/total_ttc` stockés, recalcul en secours |
| T7 PDF PU TTC | `backend/src/lib/pdf-generator.ts` | Imprimer `unit_price_ttc` stocké, dérivation en secours |
| T8 format centime | `backend/src/lib/quote-rounding.ts` (+ copie front), `pdf-generator.ts`, `email-templates.ts`, `quotes.ts`, `quote-preview.tsx`, `booking-detail.tsx`, `quote-editor.tsx`, `credit-note-dialog.tsx` | `formatEuroWhole` → `formatEuroAdaptive` sur les montants au centime |

---

## Task 0 : Préparer la branche

- [ ] **Step 1:** Depuis `main` (à jour), créer la branche.

Run:
```bash
cd /Users/thomas/Desktop/WINDSURF/restaurant-crm
git switch main && git switch -c fix/audit-batch-2
git status --short
```
Expected: branche `fix/audit-batch-2` active. (Le working tree peut contenir des modifs hors-lot non commitées — ne pas les toucher.)

---

## Task 5 : Trop-perçu sur tout l'encaissé + récap sans double comptage

**Files:**
- Modify: `backend/src/routes/quotes.ts:1354-1380` (endpoint credit-note)
- Modify: `src/features/reservations/components/booking-detail.tsx:2371-2374` (récap solde)

Pas d'infra de test backend pour cet endpoint (tests unitaires seulement sur la lib) → vérification `tsc` + relecture. Le calcul de la lib `computeCreditNote` n'est PAS modifié : seul le montant « encaissé » qu'on lui passe change.

- [ ] **Step 1 — Backend : passer l'encaissé total (pas seulement l'acompte) au trop-perçu.**

Dans `backend/src/routes/quotes.ts`, après le bloc `collectedAcompte` (lignes 1354-1359), AJOUTER le calcul de l'encaissé total, puis le passer à `computeCreditNote`. Remplacer :
```ts
  const collectedAcompte = (payments ?? [])
    .filter(
      (p: any) =>
        p.payment_modality === 'acompte' || p.payment_type === 'deposit'
    )
    .reduce((s: number, p: any) => s + (p.amount || 0), 0)
```
par :
```ts
  const collectedAcompte = (payments ?? [])
    .filter(
      (p: any) =>
        p.payment_modality === 'acompte' || p.payment_type === 'deposit'
    )
    .reduce((s: number, p: any) => s + (p.amount || 0), 0)

  // Encaissé total (toutes modalités) : même règle que le récap solde et le dialogue
  // d'avoir. Sert au trop-perçu ; l'acompte seul sert à figer deposit_amount_override.
  const collectedTtc = (payments ?? []).reduce(
    (s: number, p: any) => s + (p.amount || 0),
    0
  )
```
Puis, dans l'appel `computeCreditNote` (lignes 1375-1380), remplacer le 4e argument `collectedAcompte` par `collectedTtc` :
```ts
  const result = computeCreditNote(
    items,
    creditsById,
    q.discount_percentage ?? 0,
    collectedTtc
  )
```
NE PAS toucher `frozenDeposit` (lignes 1382-1386) : il doit garder `collectedAcompte`.

- [ ] **Step 2 — Backend : vérifier la compilation.**

Run: `cd backend && pnpm exec tsc --noEmit && cd ..`
Expected: 0 erreur.

- [ ] **Step 3 — Frontend : récap solde, calcul vivant du trop-perçu (fin du double comptage).**

Dans `src/features/reservations/components/booking-detail.tsx`, remplacer le bloc `tropPercu` (lignes 2371-2374) :
```ts
                        const tropPercu = creditNotes.reduce(
                          (sum, cn) => sum + (cn.overpaid_ttc || 0),
                          0
                        )
```
par :
```ts
                        // Trop-perçu vivant = encaissé - total effectif courant.
                        // (overpaid_ttc de chaque avoir est cumulatif : les sommer double-compte.)
                        const tropPercu = soldeRestant < 0 ? -soldeRestant : 0
```
(`soldeRestant = totalDevisTtc - paiementsRecus` est défini juste au-dessus, ligne 2365, et `totalDevisTtc` reflète déjà les avoirs puisque `quotes.total_ttc` est réécrit à l'émission. `avoirsTtc` ligne 2367-2369, la somme des `cn.total_ttc`, reste inchangée : elle est bien additive.)

- [ ] **Step 4 — Frontend : vérifier la compilation.**

Run: `pnpm exec tsc -b`
Expected: 0 erreur.

- [ ] **Step 5 — Commit.**
```bash
git add backend/src/routes/quotes.ts src/features/reservations/components/booking-detail.tsx
git commit -m "fix(avoir): trop-percu calcule sur l'encaisse total et sans double comptage"
```

---

## Task 6 : Preview lit les totaux stockés

**Files:**
- Modify: `src/features/reservations/components/quote-preview.tsx:465-486` (les deux helpers)

- [ ] **Step 1 — Lire le stocké, recalcul en secours.**

Dans `src/features/reservations/components/quote-preview.tsx`, `computeItemTtc` (lignes 465-475) et `computeItemHt` (lignes 476-486) appellent aujourd'hui `computeLineAmounts` inconditionnellement. Faire retourner la valeur stockée en priorité. Le paramètre de ces helpers doit accepter `total_ttc` / `total_ht` optionnels.

Pour `computeItemTtc`, remplacer la ligne de retour :
```ts
    return computeLineAmounts({ ...item, tva_rate: item.tva_rate ?? 20 })
```
(la ligne qui se termine par `.totalTtc`) par une lecture du stocké avec secours :
```ts
    return (
      item.total_ttc ??
      computeLineAmounts({ ...item, tva_rate: item.tva_rate ?? 20 }).totalTtc
    )
```
Idem pour `computeItemHt` avec `item.total_ht` et `.totalHt`. Ajouter `total_ttc?: number | null` (resp. `total_ht?: number | null`) au type inline du paramètre `item` de chaque helper. Utiliser `??` (pas `||`) pour préserver un total stocké à 0 (ligne offerte).

Le regroupement TVA (`tvaByRate`, lignes 514-521) et toutes les tables (devis, acompte, solde, extras, facture finale) héritent automatiquement via ces deux helpers — ne rien changer d'autre.

- [ ] **Step 2 — Vérifier la compilation.**

Run: `pnpm exec tsc -b`
Expected: 0 erreur.

- [ ] **Step 3 — Commit.**
```bash
git add src/features/reservations/components/quote-preview.tsx
git commit -m "fix(devis): la preview lit les totaux de ligne stockes (recalcul en secours)"
```

---

## Task 7 : PDF imprime le unit_price_ttc stocké

**Files:**
- Modify: `backend/src/lib/pdf-generator.ts` : interface `quote_items` (lignes 72-83) + 3 sites (882, 1067, 1170)

- [ ] **Step 1 — Exposer `unit_price_ttc` dans l'interface.**

Dans `backend/src/lib/pdf-generator.ts`, dans le type `quote_items: Array<{ ... }>` (lignes 72-83), ajouter la ligne après `unit_price: number` (ligne 77) :
```ts
    unit_price_ttc: number | null
```

- [ ] **Step 2 — Imprimer le stocké, dérivation en secours (3 sites).**

Les trois sites re-dérivent `(item.unit_price || 0) * (1 + (item.tva_rate || 0) / 100)`. Les préfixer par le stocké.

Ligne 882 (table produits, variable `item`) et ligne 1067 (table solde, variable `item`) — même expression, remplacer :
```ts
              (item.unit_price || 0) * (1 + (item.tva_rate || 0) / 100)
```
par :
```ts
              item.unit_price_ttc ??
              (item.unit_price || 0) * (1 + (item.tva_rate || 0) / 100)
```
Ligne 1170 (table extras, variable `extra`), remplacer :
```ts
              (extra.unit_price || 0) * (1 + (extra.tva_rate || 0) / 100)
```
par :
```ts
              extra.unit_price_ttc ??
              (extra.unit_price || 0) * (1 + (extra.tva_rate || 0) / 100)
```
Si le TypeScript signale que `unit_price_ttc` n'existe pas sur le type de `extra` (extras issus d'un autre type que `quote_items`), ajouter `unit_price_ttc: number | null` au type concerné de la même façon qu'au Step 1. Garder l'expression de secours identique à l'existante (pas de `round2`, `formatEuroDecimal` arrondit déjà l'affichage).

- [ ] **Step 3 — Vérifier la compilation.**

Run: `cd backend && pnpm exec tsc --noEmit && cd ..`
Expected: 0 erreur.

- [ ] **Step 4 — Commit.**
```bash
git add backend/src/lib/pdf-generator.ts
git commit -m "fix(pdf): imprime le PU TTC stocke au lieu de le re-deriver"
```

---

## Task 8 : `formatEuroWhole` → `formatEuroAdaptive` sur les montants au centime

**Files:**
- Modify: `backend/src/lib/quote-rounding.ts` (ajouter `formatEuroAdaptive`) et `src/features/reservations/lib/quote-rounding.ts` (déjà présent — parité)
- Modify: `backend/src/lib/pdf-generator.ts`, `backend/src/lib/email-templates.ts`, `backend/src/routes/quotes.ts`, `src/features/reservations/components/quote-preview.tsx`, `src/features/reservations/components/booking-detail.tsx`, `src/features/reservations/components/quote-editor.tsx`, `src/features/reservations/components/credit-note-dialog.tsx`

Balayage mécanique : `formatEuroAdaptive` affiche un entier si le montant est rond (à 0,5 cent près) et 2 décimales sinon. Les anciens devis à totaux entiers restent affichés à l'identique ; seuls les montants au centime changent.

- [ ] **Step 1 — Porter `formatEuroAdaptive` côté backend.**

Dans `backend/src/lib/quote-rounding.ts`, juste après `formatEuroDecimal` (qui se termine ligne ~86), ajouter (copie verbatim de la version frontend `src/features/reservations/lib/quote-rounding.ts:93-98`) :
```ts
// Entier si rond (à 0,5 cent près), décimal sinon. Pour montants pouvant
// venir de Stripe (entiers) OU saisis manuellement (décimaux possibles).
export function formatEuroAdaptive(amount: number): string {
  const isWhole = Math.abs(amount - Math.round(amount)) < 0.005
  return isWhole ? formatEuroWhole(amount) : formatEuroDecimal(amount)
}
```
Corriger aussi le commentaire mensonger de `formatEuroWhole` (ligne ~63 `// Format "1 234 €" — pour TTC entiers.`) en `// Format "1 234 €" (entier). Utilise formatEuroAdaptive pour un montant pouvant porter des centimes.`

- [ ] **Step 2 — Backend : `pdf-generator.ts` (14 sites).**

Ajouter `formatEuroAdaptive` à l'import depuis `./quote-rounding.js` (ligne 8, à côté de `formatEuroWhole`). Puis remplacer `formatEuroWhole` par `formatEuroAdaptive` à chacune de ces lignes : 904, 1086, 1189, 1353, 1427, 1476, 1488, 1530, 1599, 1657, 1677, 2262, 2364, 2382. Corriger les commentaires « Total TTC (entier) » voisins s'il y en a (~1516/1525). Après le balayage, `formatEuroWhole` n'est plus utilisé dans ce fichier → le retirer de l'import.

- [ ] **Step 3 — Backend : `email-templates.ts` (2 sites).**

Import ligne 5 : remplacer `formatEuroWhole` par `formatEuroAdaptive`. Ligne 37 (`return formatEuroWhole(amount)`) et ligne 651 → `formatEuroAdaptive`. Corriger le commentaire ~34-35 « alignés sur la règle d'arrondi des devis » s'il évoque l'euro entier.

- [ ] **Step 4 — Backend : `quotes.ts` (client-facing + logs).**

Import ligne 18 : ajouter `formatEuroAdaptive`. Remplacer `formatEuroWhole` par `formatEuroAdaptive` aux lignes 708, 730, 745, 762, 1102, 1149 (730/745 = description/footer de la facture Stripe visible client ; les autres = logs, à aligner pour que le log == le montant Stripe). Après balayage, retirer `formatEuroWhole` de l'import s'il n'est plus utilisé.

- [ ] **Step 5 — Frontend : `quote-preview.tsx` (16 sites).**

Import ligne 6 : remplacer `formatEuroWhole` par `formatEuroAdaptive`. Remplacer `formatEuroWhole` par `formatEuroAdaptive` aux lignes 689, 753, 777, 791, 977, 1004, 1190, 1207, 1283, 1305, 1351, 1396, 1553, 1625, 1666, 1703.

- [ ] **Step 6 — Frontend : `booking-detail.tsx` (2 sites restants).**

Lignes 2415 (`formatEuroWhole(baseTtc)`) et 2424 (`formatEuroWhole(extrasTtc)`) → `formatEuroAdaptive`. Aussi lignes 1712 et 3569 (TTC dans les listes de devis) → `formatEuroAdaptive`, pour ne pas afficher « 103 € » à côté d'un détail « 102,60 € ». `formatEuroAdaptive` est déjà importé (ligne 95). Après balayage, retirer `formatEuroWhole` de l'import s'il n'est plus utilisé.

- [ ] **Step 7 — Frontend : `quote-editor.tsx` (extras → décimal).**

Lignes 2532 et 2613 (`formatEuroWhole(extra.total_ttc ...)`) → `formatEuroDecimal` (convention de l'éditeur, tout est en décimal depuis 66b2141). Import ligne 100 : ajouter `formatEuroDecimal` s'il n'y est pas, retirer `formatEuroWhole` s'il n'est plus utilisé ailleurs dans ce fichier.

- [ ] **Step 8 — Frontend : `credit-note-dialog.tsx` (4 sites).**

Import ligne 31 : remplacer `formatEuroWhole` par `formatEuroAdaptive`. Lignes 136, 139, 227, 231 → `formatEuroAdaptive`.

- [ ] **Step 9 — Vérifier build + lint (imports inutilisés).**

Run:
```bash
pnpm exec tsc -b
cd backend && pnpm exec tsc --noEmit && cd ..
pnpm exec eslint src/features/reservations/components/quote-preview.tsx src/features/reservations/components/booking-detail.tsx src/features/reservations/components/quote-editor.tsx src/features/reservations/components/credit-note-dialog.tsx backend/src/lib/pdf-generator.ts backend/src/lib/email-templates.ts backend/src/routes/quotes.ts backend/src/lib/quote-rounding.ts
```
Expected : `tsc` 0 erreur des deux côtés. ESLint : aucune erreur `no-unused-vars`/import inutilisé introduite par ce balayage (résoudre tout import `formatEuroWhole` devenu inutile en le retirant). La dette ESLint préexistante peut rester.

- [ ] **Step 10 — Vérifier la parité des deux copies de quote-rounding.**

Run: `diff <(grep -A4 "formatEuroAdaptive" backend/src/lib/quote-rounding.ts) <(grep -A4 "formatEuroAdaptive" src/features/reservations/lib/quote-rounding.ts)`
Expected : la logique de `formatEuroAdaptive` est identique dans les deux copies.

- [ ] **Step 11 — Commit.**
```bash
git add backend/src/lib/quote-rounding.ts backend/src/lib/pdf-generator.ts backend/src/lib/email-templates.ts backend/src/routes/quotes.ts src/features/reservations/components/quote-preview.tsx src/features/reservations/components/booking-detail.tsx src/features/reservations/components/quote-editor.tsx src/features/reservations/components/credit-note-dialog.tsx
git commit -m "fix(affichage): montants au centime via formatEuroAdaptive (documents, preview, emails)"
```

---

## Commit rules (toutes les tâches)

Sujet une seule ligne courte en français, pas de corps. JAMAIS de trailer `Co-Authored-By`, aucun footer, aucune mention IA, pas d'emoji. `git add` CIBLÉ sur les fichiers de la tâche (le working tree contient des modifs hors-lot à ne pas committer).

## Self-Review

- **Couverture spec :** items 5 (T5 back + récap front), 6 (T6), 7 (T7), 8 (T8) — les 4 demandés.
- **Placeholders :** chaque step montre le code réel avant/après. T8 énumère les lignes exactes par fichier ; le seul jugement laissé à l'implémenteur est le retrait des imports `formatEuroWhole` devenus inutiles, guidé par tsc/eslint (Step 9).
- **Cohérence de types :** `collectedTtc` (T5) est un `number` comme `collectedAcompte`. Les helpers preview (T6) gagnent des champs optionnels `total_*`. L'interface PDF (T7) gagne `unit_price_ttc`. `formatEuroAdaptive` a la même signature `(number) => string` que `formatEuroWhole`.
- **Ordre :** T8 en dernier balaye des fichiers déjà modifiés par T5/T6/T7 (booking-detail, quote-preview, pdf-generator) — commits séquentiels, pas de conflit.
