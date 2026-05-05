# Arrondi des devis à l'euro entier (`Math.ceil`)

**Date** : 2026-05-05
**Auteur** : Thomas
**Statut** : Validé — en cours d'implémentation

## Contexte

À ce jour, l'ensemble du flow devis (frontend, backend, BDD, PDF, email, Stripe) arrondit les montants au centime, suite aux commits `ce12c09` (frontend/backend), `8b53f17` (migration BDD), `24c50a6` (acompte/solde). Cet alignement a été utile pour stabiliser les divergences mais le métier veut maintenant que **chaque ligne de devis soit un montant entier en euros**, avec le total TTC = somme de ces lignes.

Le but : ce que le client voit (PDF, email, Stripe) est un nombre rond, jamais de centimes.

## Règle d'arrondi

```
Pour chaque ligne :
  raw_ttc    = (quantity × unit_price - discount_amount) × (1 + tva_rate / 100)
  line_ttc   = Math.ceil(raw_ttc)              ← ENTIER, source de vérité
  line_ht    = line_ttc / (1 + tva_rate / 100) ← décimal, dérivé

Pour le devis (avec remise globale optionnelle) :
  raw_total_ttc = SUM(line_ttc)                                         ← entier
  total_ttc     = Math.ceil(raw_total_ttc × (1 - discount_pct/100))     ← entier
  total_ht      = SUM(line_ht) × (1 - discount_pct/100)                 ← décimal
  total_tva     = total_ttc - total_ht                                  ← décimal
```

**Invariant** : `total_ttc` est toujours un entier. C'est ce qui est stocké en BDD, affiché sur le PDF, envoyé dans l'email et facturé via Stripe.

**Sens d'arrondi** : `Math.ceil` (toujours au supérieur) — cohérent avec le calcul existant pour l'acompte. Choix produit : ne jamais sous-facturer.

## Helper unifié

Création de `src/features/reservations/lib/quote-rounding.ts` (frontend) et `backend/src/lib/quote-rounding.ts` (backend, copie isomorphe car le backend n'importe pas de TS frontend).

API publique des deux modules :

```ts
// Calcule le TTC d'une ligne, arrondi au supérieur à l'euro.
function roundLineTtc(
  quantity: number,
  unitPrice: number,
  discountAmount: number,
  tvaRate: number,
): number;

// Dérive le HT d'une ligne à partir de son TTC arrondi.
function deriveLineHt(lineTtc: number, tvaRate: number): number;

// Calcule les 3 totaux d'un devis depuis ses lignes (avec remise globale).
function computeQuoteTotals(
  items: Array<{
    quantity: number;
    unit_price: number;
    discount_amount: number | null;
    tva_rate: number;
  }>,
  discountPercentage?: number,
): { totalHt: number; totalTva: number; totalTtc: number };
```

**Règle non-négociable** : tout calcul de montant de devis doit passer par ces fonctions. Aucun `Math.round(... * 100) / 100` ailleurs dans le code lié aux devis.

## Sites d'appel à refactorer

### Frontend
- `src/features/reservations/components/quote-editor.tsx` — calcul inline d'affichage (lignes 650-666) + colonne TTC table
- `src/features/reservations/components/quote-preview.tsx` — `computeItemHt`, `computeItemTtc`, regroupement TVA par taux (lignes 346-364)
- `src/features/reservations/hooks/use-quotes.ts` — `recalculateQuoteTotals` (987-1036), `useAddQuoteItem` (862-863), `useUpdateQuoteItem` (923-924), `useDeleteQuoteItem` (976)

### Backend
- `backend/src/lib/pdf-generator.ts` — `resolveDepositTtc`/`resolveDepositHt` (233-245), `formatCurrency` (228-230). Crée `formatEuroWhole` pour TTC, garde `formatCurrency` (renommé `formatEuroDecimal`) pour HT/TVA.
- `backend/src/lib/email-templates.ts` — `formatCurrency` (32-34) → applique `formatEuroWhole` aux TTC affichés.
- `backend/src/routes/quotes.ts` — vérifier que les calculs `Math.ceil` pour acompte (520) et solde sont cohérents. Stripe reçoit déjà des cents via `Math.round(amount × 100)` (603) ; comme `amount` est désormais entier, ça reste correct.

## Format d'affichage

Deux formatters côté UI et côté backend :

- `formatEuroWhole(n)` → `"1 234 €"` (sans virgule ni décimales) — pour : ligne TTC, total TTC, acompte, solde, montants email, montants Stripe affichés
- `formatEuroDecimal(n)` → `"1 234,56 €"` — pour : ligne HT (dérivé décimal), total HT, total TVA, TVA par taux

## Migration base de données

Fichier : `supabase/migrations/20260505_round_quotes_to_whole_euros.sql`

Filtre de sécurité : `deposit_paid_at IS NULL AND balance_paid_at IS NULL` — n'altère que les devis non encaissés. Les 2 devis figés en BDD restent intouchés (documents fiscaux émis).

Logique :
1. `UPDATE quote_items` : recalcule `total_ttc = CEIL(...)` et `total_ht = total_ttc / (1 + tva/100)` pour chaque item d'un devis éligible (sauf `item_type = 'extra'`).
2. `UPDATE quotes` : recalcule `total_ttc`, `total_ht`, `total_tva` depuis la somme des items mis à jour, en appliquant `discount_percentage`.

Idempotente : peut être relancée sans effet de bord.

## Ordre de déploiement

Pour éviter qu'un commercial éditant un devis pendant la transition ne ré-arrondisse au centime via l'ancien code :

1. **Étape 1** — Code refactor merged + déployé (helper, frontend, backend)
2. **Étape 2** — Migration SQL appliquée

Inversion possible mais risque de re-rétrogradation si un item est édité entre les deux étapes.

## Vérification

- Tests manuels dans le navigateur : créer un devis avec items à TVA mixte (10 % et 20 %), vérifier l'affichage et les valeurs persistées.
- PDF généré : vérifier que les TTC ligne et le total TTC sont des entiers ; HT/TVA en décimal cohérents.
- Email envoyé au client : montant TTC entier dans le corps.
- Stripe : payment intent reçoit `total_ttc × 100` cents (entier × 100 = entier).
- Acompte/solde : déjà entiers via `Math.ceil`, comportement inchangé.

## Hors périmètre

- Correction des `tva_rate` aberrants (ex. `0.20` au lieu de `20.00`) — fix manuel séparé si jugé nécessaire.
- Refonte de l'UI éditeur au-delà des colonnes/totaux concernés.
- Migration des `quote_extras` (les extras sont billés à part).
