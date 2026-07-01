# Devis verbatim (suppression de l'arrondi metier et de la derivation) — Design

Date : 2026-07-01
Statut : valide (brainstorm), pret pour plan

## 1. Contexte et objectif

On abandonne l'arrondi metier et la derivation HT<->TTC sur les devis/factures. Les commerciaux saisissent les montants exacts (PU HT et PU TTC par ligne) ; le systeme stocke verbatim et somme. Motive par les bugs d'arrondi recurrents (surfacturation, ceil-a-l'euro par ligne, mismatch HT+TVA!=TTC). Le formatage d'affichage est conserve.

Le systeme fait desormais confiance a ce qui est saisi. On perd les garanties automatiques "HT+TVA=TTC derive" ; en echange `HT+TVA=TTC` par ligne tient **par construction** (TVA = TTC - HT sur les valeurs saisies).

## 2. Modele cible

- **Par ligne** : quantite, **PU HT et PU TTC edites independamment** (les deux stockes, plus aucune derivation d'un cote a partir de l'autre). Total ligne = qte x PU de chaque cote (moins remise ligne). TVA ligne = `total_ttc - total_ht`. On conserve : quantite, remise ligne (soustraite des deux cotes), taux TVA (uniquement pour le **regroupement d'affichage** sur la facture, plus pour deriver).
- **Plus de derivation HT<->TTC, plus de ceil-a-l'euro.** `round2` reduit a une **normalisation au centime anti-bruit flottant** (ex. 87,499999 -> 87,50), pas un arrondi metier. La monnaie reste au centime.
- **Total devis** = somme des totaux de lignes (normalisee au centime).
- **Acompte : inchange.** Les deux modes restent (`deposit_percentage` en %, ou `deposit_amount_override` en euros). Solde = `total - acompte` (soustraction). Durcissement : figer l'acompte en euros au paiement (cf 3.4).
- **Devis existants** : totaux stockes **intacts**. Une ligne "legacy" (un seul PU stocke, l'autre etait derive) reste affichable via un fallback de derivation a la lecture ; des qu'elle est editee, elle passe en verbatim.
- **Formatage** (`formatEuroWhole/Decimal/Adaptive`, `normalizeFrenchSpaces`) : conserve tel quel.

## 3. Detail des changements

### 3.1 Lib `quote-rounding.ts` (2 copies isomorphes : front + back)

- **`computeLineAmounts`** (`src/features/reservations/lib/quote-rounding.ts:139`, backend jumeau) : si `unit_price` **et** `unit_price_ttc` sont presents (non-null) -> chemin **verbatim** :
  - `totalHt = round2(qty * unit_price - discount)`
  - `totalTtc = round2(qty * unit_price_ttc - discount)`
  - `totalTva = round2(totalTtc - totalHt)`
  - aucune derivation d'un cote a partir de l'autre.
  Sinon (une seule unite presente, ligne legacy) -> comportement de derivation actuel (inchange), pour ne pas casser l'affichage des anciens devis.
  Le `round2` ici est une normalisation centime (anti-bruit), pas un ceil.
- **`computeQuoteAmounts`** / **`recalculateQuoteTotals`** (`use-quotes.ts:1171`, `quotes.ts:1403`) : deja une somme des lignes ; on garde, la somme passe par le `computeLineAmounts` verbatim. `round2` au niveau total = normalisation centime.
- **`computeDepositAmounts`** / **`computeBalanceTtc`** : **inchanges** (on garde les deux modes d'acompte). Le `round2` sur l'acompte % est benin et `acompte + solde = total` reste exact (solde = soustraction).
- **`deriveUnitHt` / `deriveUnitTtc`** : conserves (fallback legacy + affichage), mais **plus appeles par les handlers de saisie** de l'editeur pour ecraser l'autre cote.

### 3.2 Editeur — `src/features/reservations/components/quote-editor.tsx`

- **Blur TTC** (`:249-256`) : ecrit `unit_price_ttc` + `price_entry_mode`, **ne derive plus** `unit_price`.
- **Blur HT** (`:266-273`) : ecrit `unit_price`, **ne wipe plus** `unit_price_ttc` (`unit_price_ttc: null` supprime).
- **Blur TVA** (`:282-299`) : **ne re-derive plus** ni HT ni TTC ; le taux n'affecte que l'affichage/regroupement.
- Les champs PU HT et PU TTC deviennent tous deux editables et independants (ils existent deja ; on arrete juste l'ecrasement mutuel).
- `defaultValue` du champ TTC (`:243-248`) : lire `unit_price_ttc` verbatim ; garder un fallback derive seulement quand `unit_price_ttc` est null (ligne legacy).
- Signal verbatim : "les deux unites presentes" suffit pour que `computeLineAmounts` prenne le chemin verbatim. **Pas de nouveau `price_entry_mode`, pas de migration CHECK.**

### 3.3 Preview + PDF

- **`quote-preview.tsx`** (`computeItemTtc:473`, `computeItemHt:484`, `computeItemUnitTtc:495`) : lire les valeurs **stockees** (`total_ht`, `total_ttc`, `unit_price_ttc`) plutot que recomputer ; le regroupement TVA (`tvaByRate`) se rebatit depuis les `total_ht`/`total_ttc` stockes des lignes.
- **`pdf-generator.ts`** : imprime les `total_ht`/`total_ttc`/`total_tva` stockes et les valeurs de lignes stockees. `resolveDepositTtc`/`resolveDepositHt` (`:259/:272`) **inchanges** (on garde %) ; la ventilation HT de l'acompte via le ratio HT/TTC global reste valable. Les libelles "%" du planning restent (on garde l'acompte %).

### 3.4 Acompte fige au paiement (durcissement)

Quand un acompte passe paye (webhook Stripe `webhooks.ts:~1117/386-448` et paiement manuel `use-bookings.ts:849-857`), ecrire aussi `deposit_amount_override = montant reellement encaisse` si l'override est null. Empeche la derive d'un acompte % si le total change apres coup. Chemin chaud -> a tester.

## 4. Invariants a preserver

1. `acompte + solde = total` (solde = soustraction stricte).
2. `HT + TVA = TTC` par ligne **par construction** (TVA = TTC - HT sur les valeurs saisies).
3. Somme des lignes = total stocke (normalisation centime au total, pas de re-arrondi par ligne).
4. Les deux copies de `quote-rounding.ts` restent synchronisees.
5. Devis existants : `total_ht/total_tva/total_ttc` stockes non modifies par ce chantier.
6. `round2` = normalisation centime uniquement ; plus aucun `Math.ceil`/ceil-a-l'euro sur les lignes.

## 5. Risques / angles morts

- **Lignes legacy** (un seul PU stocke) : fallback derivation a la lecture, ne pas casser l'affichage ; l'edition les fait basculer en verbatim.
- **Ajouts catalogue / packages** : n'apportent que le HT (`unit_price`), donc `unit_price_ttc` null -> derive jusqu'a ce que le commercial saisisse le TTC. Comportement accepte.
- **Remise ligne** (`discount_amount`, scalaire unique) : soustraite des deux cotes ; l'implied rate peut ne plus etre coherent. Assume (verbatim).
- **Dialogue Extras** (`quote-editor.tsx:2306-2412`) : n'expose qu'un PU TTC et stocke `unit_price` via `deriveHtFromTtc` (`src/lib/price.ts:3-7`, floor). Ajouter un champ PU HT, stocker les deux unites, **supprimer** l'appel `deriveHtFromTtc`.
- **Bruit flottant** : `round2` centime au stockage des totaux de ligne et du total devis.
- **Coherence saisie** : si le commercial tape un TTC incoherent avec le HT, rien ne le rattrape (c'est le principe verbatim, accepte).

## 6. Hors perimetre

- Backfill/recalcul des lignes ou devis existants.
- Suppression de `deposit_percentage` (on **garde** les deux modes d'acompte).
- La facture d'avoir (parquee ; branche `feat/facture-avoir` Tasks 1-2). Elle devient triviale une fois le verbatim en place (acompte deja un montant, avoir = ancien total - nouveau en soustraction). On y reviendra apres.

## 7. Fichiers touches (index)

Lib
- `src/features/reservations/lib/quote-rounding.ts` — `computeLineAmounts` verbatim (both-present).
- `backend/src/lib/quote-rounding.ts` — jumeau iso.

Frontend
- `src/features/reservations/components/quote-editor.tsx` — handlers blur HT/TTC/TVA (`:249-299`), champs PU editables, dialogue Extras (`:2306-2412`).
- `src/features/reservations/components/quote-preview.tsx` — `computeItem*` (`:473/484/495`), regroupement TVA (`:514-520`).
- `src/features/reservations/hooks/use-quotes.ts` — `useAddQuoteItem`/`useUpdateQuoteItem` (passer les deux unites), `recalculateQuoteTotals` (`:1171`).

Backend
- `backend/src/routes/quotes.ts` — `recalculateQuoteTotals` (`:1403`).
- `backend/src/lib/pdf-generator.ts` — lecture des totaux stockes.
- `backend/src/routes/webhooks.ts`, `src/features/reservations/hooks/use-bookings.ts` — figer l'acompte au paiement (3.4).

Tests
- `backend/tests/quote-rounding.test.ts` — ajouter des cas verbatim (both-present) ; garder les cas legacy derivation.

## 8. Impact prod

- **Aucune migration** requise (on se base sur "les deux unites presentes", pas de nouveau mode/CHECK). Le durcissement 3.4 ne touche que les paiements futurs.
- Changement visible sur **tous** les nouveaux devis (saisie + PDF). Devis existants inchanges. A verifier sur un devis reel en preview avant merge.
- Le refactor rend en grande partie caduque la lib de rounding recente (30 juin) : les fonctions de derivation/ceil restent pour le fallback legacy mais ne pilotent plus la saisie.
