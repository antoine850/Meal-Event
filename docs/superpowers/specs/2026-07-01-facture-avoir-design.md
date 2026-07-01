# Facture d'avoir — Design

Date : 2026-07-01
Statut : validé (brainstorm), prêt pour plan d'implémentation

## 1. Contexte et objectif

Aujourd'hui, retirer une prestation d'un devis déjà payé (acompte ou solde) n'a pas de traitement propre dans le CRM. Sur l'ancien CRM (Booking Shake), on retire la prestation du devis, on recrée un devis avec la prestation retirée et on le transforme en facture d'avoir, pour obtenir au final un avoir + une facture de solde cohérente.

Objectif : un bouton **"Générer une facture d'avoir"** sur un devis/facture, qui demande les prestations à créditer, met à jour le devis (donc la facture de solde), et produit une **facture d'avoir** cohérente à la centime, sans incohérence sur l'acompte ni sur le solde.

Périmètre v1 : préfixe **AV seul** (pas de renumérotation des factures/devis existants). Pas de remboursement automatisé.

## 2. Principes

### Fiscal
- Une facture déjà émise au client ne se réédite pas ; on la corrige par un avoir (document séparé, numéroté, daté, référençant le document d'origine).
- L'acompte déjà encaissé est un montant fixe : il ne doit jamais être recalculé en pourcentage d'un total qui a changé.
- Un avoir est immuable une fois émis (pas d'édition/suppression en v1).

### Moteur de calcul (règle centrale)
Montant de l'avoir = **ancien total effectif − nouveau total effectif**, mesuré *après* recalcul des totaux stockés. On ne recalcule jamais un montant d'avoir indépendamment. Ça garantit `avoir TTC = réduction réelle du devis` à la centime (HT et TVA compris), et absorbe les dérives d'arrondi des crédits partiels.

Le "total effectif" inclut les extras (voir §5.1) : `total_ttc + Σ extras.total_ttc`.

## 3. Modèle de données

Tables dédiées (pas de surcharge de `quotes`). Toutes scopées `organization_id`, RLS org-scopée calquée sur l'existant.

### 3.1 `credit_notes`
| Colonne | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid FK organizations | scope multi-tenant |
| `restaurant_id` | uuid FK restaurants, nullable | entité émettrice (résolue via le booking) |
| `booking_id` | uuid FK bookings | |
| `quote_id` | uuid FK quotes | le devis/facture corrigé |
| `avoir_number` | text | ex. `AV-2026-0001`, unique par entité émettrice |
| `issued_at` | timestamptz | date d'émission (assignée à la validation) |
| `reason` | text | motif de l'avoir |
| `total_ht` | numeric | montant crédité HT (magnitude positive) |
| `total_tva` | numeric | montant crédité TVA |
| `total_ttc` | numeric | montant crédité TTC |
| `old_effective_ttc` | numeric | snapshot audit : total effectif avant |
| `new_effective_ttc` | numeric | snapshot audit : total effectif après |
| `overpaid_ttc` | numeric | trop-perçu affiché (0 si aucun), cf §5.6 |
| `created_by` | uuid FK users | |
| `created_at` | timestamptz | |

Convention de signe : totaux stockés en **magnitude positive** (le crédité), affichés en négatif sur le PDF.

### 3.2 `credit_note_items`
Snapshot des lignes créditées (indépendant du `quote_items` d'origine, qui peut être supprimé/réduit ensuite).
| Colonne | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `credit_note_id` | uuid FK credit_notes (cascade) | |
| `source_quote_item_id` | uuid, nullable | référence indicative |
| `name` | text | |
| `description` | text, nullable | |
| `quantity` | numeric | |
| `unit_price` | numeric | HT |
| `tva_rate` | numeric | |
| `item_type` | text | `product` \| `extra` |
| `total_ht` | numeric | portion créditée HT |
| `total_ttc` | numeric | portion créditée TTC |
| `credited_ttc` | numeric | montant TTC réellement crédité sur cette ligne |

### 3.3 `document_counters` (+ RPC atomique)
Compteur séquentiel sans trou, par entité émettrice et par an.
| Colonne | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid FK | |
| `restaurant_id` | uuid, nullable | null → compteur au niveau org |
| `doc_type` | text | `avoir` (extensible) |
| `year` | int | |
| `last_value` | int | dernier numéro attribué |

Contrainte unique : `(organization_id, restaurant_id, doc_type, year)`.

RPC `next_document_number(org, restaurant, doc_type, year)` en `SECURITY DEFINER`, atomique (`INSERT ... ON CONFLICT (...) DO UPDATE SET last_value = document_counters.last_value + 1 RETURNING last_value`). Verrou de ligne implicite sur le conflit → pas de course, pas de trou. Appelée **dans la même transaction** que l'insertion de l'avoir (§8).

### 3.4 `documents` (ajouts)
- `doc_kind` text, nullable : `devis` \| `facture_acompte` \| `facture_solde` \| `avoir`.
- `credit_note_id` uuid FK credit_notes, nullable.

Le badge de type dans la liste Fichiers se dérive de `doc_kind` si présent, sinon du préfixe de `name` (pour les documents existants créés avant). On ne touche pas au comportement de `savePdfAsDocument` pour les devis/factures (pas de fix groupé, cf §10).

### 3.5 `quotes`
Aucune nouvelle colonne. Le figeage de l'acompte réutilise `deposit_amount_override` (existant, migration `20260422`). Le lien vers les avoirs se fait par `credit_notes.quote_id`. Le total réduit vit dans `total_ht`/`total_ttc` existants.

## 4. Numérotation AV

Format `AV-{année}-{séquence}` (ex. `AV-2026-0001`). Compteur scopé `(organization_id, restaurant_id, année)`. Restaurant résolu via `quote.booking_id → bookings.restaurant_id`. `bookings.restaurant_id` est **nullable** : si null, on retombe sur un compteur au niveau organisation (`restaurant_id = null`).

Numéro assigné **à la validation** (émission officielle), immuable ensuite. Le préfixe littéral est `AV` (fixe en v1 ; on pourra le rendre configurable par restaurant plus tard). Le devis garde son `quote_number` ; l'avoir référence ce `quote_number` d'origine sur le PDF.

## 5. Le moteur de calcul

### 5.1 Total effectif
`quotes.total_ttc` **exclut** les extras (`recalculateQuoteTotals` filtre `item_type === 'extra'`, use-quotes.ts:1180-1182). Les extras sont facturés uniquement sur la facture de solde, rajoutés par-dessus (pdf-generator.ts:1495-1500). Donc l'avoir raisonne sur le **total effectif** :

```
effectiveTtc(quote, items) = quote.total_ttc + Σ items[item_type==='extra'].total_ttc
```

Helper partagé (frontend + backend, dans les deux copies de `quote-rounding.ts` ou un module commun) pour que l'avoir, la facture de solde et le récap booking ne dérivent pas.

### 5.2 Figer l'acompte
Au moment de générer l'avoir : `deposit_amount_override = acompte réellement encaissé`, lu dans le **registre des paiements** via `getPaidDeposits(payments)` (somme des lignes `payment_modality==='acompte' || payment_type==='deposit'` en `status ∈ {paid, completed}`). Si aucune ligne (vieux devis marqué payé sans encaissement enregistré), fallback sur l'acompte calculé sur l'ancien total effectif avant réduction.

Raison : lire le registre (et pas `status`/`*_paid_at`) capte aussi les **paiements manuels**, qui ne remplissent pas les colonnes timestamp (cf angle mort §13).

### 5.3 Réduction des lignes
Dialogue par ligne : montant TTC à créditer, défaut = TTC de la ligne.
- Crédit == TTC ligne (retrait total) → suppression du `quote_item`.
- Crédit < TTC ligne (offert partiel) → **réduction sur la ligne** : on augmente `discount_amount` pour que le total de la ligne baisse du montant crédité, en respectant `price_entry_mode` (montant côté anchored : si `ttc`, le discount est en TTC ; si `ht`, on convertit le crédit TTC en HT). `computeLineAmounts` re-dérive et arrondit.

Puis `recalculateQuoteTotals(quote_id)` réécrit `total_ht/total_tva/total_ttc` (produits seulement, comme aujourd'hui). Les extras réduits sont captés à la volée par les deux chemins de solde qui recalculent `extrasTtc` depuis les lignes vivantes.

### 5.4 Montant de l'avoir
```
avoirTtc = round2(oldEffectiveTtc - newEffectiveTtc)
avoirHt  = round2(oldEffectiveHt  - newEffectiveHt)
avoirTva = round2(avoirTtc - avoirHt)
```
Le "avant" est snapshoté au début de l'opération, le "après" mesuré après recalcul. Les montants par ligne du `credit_note_items` sont informatifs ; l'autorité est ce delta.

### 5.5 Cohérence du solde (les deux chemins)
La facture de solde a deux calculs :
- Email + lien Stripe (`send-balance`, quotes.ts:1053-1064) : `total effectif − acompte config` (override sinon %).
- PDF facture de solde (pdf-generator.ts:1495-1500) : `total effectif − Σ paiements encaissés`.

Après avoir figé l'override = acompte encaissé et réduit le total, **les deux tombent sur le bon solde réduit**, à condition de **ne jamais enregistrer l'avoir comme une ligne de paiement** (sinon le PDF le compte deux fois : total baissé + avoir soustrait). L'avoir n'écrit donc rien dans `payments`.

Divergence pré-existante connue (hors périmètre) : si l'override ≠ l'encaissé, ou si un bout de solde a déjà été payé, les deux chemins peuvent diverger. Le durcissement §9 (figer l'acompte au paiement) la réduit. Non corrigé ici.

### 5.6 Trop-perçu (pas de remboursement)
```
overpaidTtc = max(0, encaissé - newEffectiveTtc)
```
> 0 uniquement si le devis était déjà (trop) payé avant l'avoir. Dans ce cas, pas de remboursement automatisé : on stocke `overpaidTtc`, on l'affiche "Trop-perçu : X €" dans le récap solde et sur le PDF d'avoir. Le remboursement éventuel se gère hors appli. Cas normal (acompte payé, solde non réglé) : `overpaidTtc = 0`, le solde diminue simplement.

## 6. Flux UI/UX

### 6.1 Point d'entrée
Item **"Générer une facture d'avoir"** dans le menu `...` de chaque devis (booking-detail.tsx, avant "Supprimer" ~L2127). Disponible quel que soit l'état (même non payé), garde par confirmation.

### 6.2 Dialogue de sélection
`Dialog` listant les prestations du devis (produits + extras). Par ligne : case "créditer" + champ "montant à créditer TTC" (défaut = TTC ligne, éditable à la baisse). Champ **motif**. Pied en temps réel : montant de l'avoir, nouveau total devis, nouveau solde, trop-perçu éventuel (calculés depuis le registre).

### 6.3 Confirmation
`AlertDialog` (clone du pattern suppression booking-detail.tsx:3474-3510) résumant l'effet, adapté à l'état :
- rien émis/payé : "Aucune facture émise, tu peux simplement modifier le devis. Émettre un avoir quand même ?"
- payé : "Avoir de X € sur {quote_number} : acompte figé à Y €, devis ramené à Z €, [solde réduit à S € / trop-perçu R €]. Document fiscal, irréversible."

### 6.4 Affichage
- **Sous-carte "Avoirs"** dans l'onglet Facturation, après la carte "Devis / Offres / Factures" (booking-detail.tsx ~après L2189). Une carte inline par avoir (numéro, date, montant, motif, lien PDF).
- **Récap solde** (IIFE booking-detail.tsx:2212-2326) : ligne "Avoirs émis" et, si trop-perçu, ligne "Trop-perçu" en rouge.
- **Fichiers** : badge de Type (Devis / Facture acompte / Facture solde / Avoir) + date. L'avoir apparaît comme document immuable.

## 7. PDF facture d'avoir

Nouveau `DocumentType = 'avoir'` (pdf-generator.ts:40) + branche dédiée. Réutilise tout le légal émetteur (SIRET, TVA, SIREN, RCS, capital, IBAN...) depuis `restaurants` — rien à créer. Ajouts :
- Label bilingue `creditNote` ("FACTURE D'AVOIR" / "CREDIT NOTE") dans `labels.fr/en` + `docTitles` (449-453).
- Référence facture d'origine = `quote.quote_number` (dérivable, pas de nouvelle colonne).
- Motif = `credit_notes.reason`.
- Table des prestations créditées (montants en négatif), ventilation TVA, montant total crédité. Pas de planning de paiement. Bloc coordonnées bancaires seulement si un remboursement est mentionné (v1 : non).

Conditions/CGV d'avoir : pas de champ éditable en v1 (mentions standard). La colonne inutilisée `conditions_facture` reste disponible pour un recyclage ultérieur si des CGV d'avoir éditables sont demandées.

## 8. Backend (endpoint + atomicité)

Endpoint `POST /api/quotes/:id/credit-note`. Corps : lignes créditées (`quote_item_id`, `credited_ttc`), motif. Séquence :
1. Charge quote + items + payments.
2. Calcule en JS (lib d'arrondi partagée) : acompte encaissé (freeze), snapshot `oldEffective*`, application des réductions de lignes, `newEffective*`, `avoir*`, `overpaidTtc`.
3. Écrit tout en **une transaction** via un RPC Postgres `create_credit_note(...)` qui reçoit les valeurs déjà calculées : update `quote_items` (delete/reduce), update `quotes` (`total_*`, `deposit_amount_override`), insert `credit_notes` + `credit_note_items`, bump du compteur (`next_document_number`) — le tout atomique.
4. Hors transaction : génère le PDF d'avoir, l'upload (chemin unique), insert la ligne `documents` (`doc_kind='avoir'`, `credit_note_id`). Log l'activité. Si le PDF échoue, l'avoir existe déjà et le PDF est régénérable à la demande.

La logique d'arrondi nouvelle (helper `effectiveTtc`, réductions de ligne) va dans **les deux copies** de `quote-rounding.ts` (frontend + backend) ou un module partagé — invariant de synchronisation existant.

## 9. Figer l'acompte au paiement (durcissement)

Quand un acompte passe payé (webhook Stripe webhooks.ts:386-448 **et** mutation manuelle use-bookings.ts:849-857), écrire aussi `deposit_amount_override = montant réellement encaissé`. Tue la dérive de l'acompte en % sur tout chemin d'édition, pas seulement l'avoir, et rapproche les deux chemins de solde (§5.5). Après paiement, la facture d'acompte affiche un montant fixe (plus correct qu'un %). Chemin chaud → à tester.

## 10. Stockage documents

Pas de fix groupé (décidé : la facture d'acompte n'est jamais régénérée par l'avoir, la facture de solde ne part pas systématiquement avant). On garde uniquement, côté avoir :
- PDF d'avoir sur chemin unique `${org}/quotes/${quoteId}/avoir-${avoir_number}.pdf` (jamais écrasé).
- badge de Type dans Fichiers.

Le comportement écrasement/doublon existant de `savePdfAsDocument` pour devis/factures reste inchangé (chantier séparé si un jour souhaité).

## 11. Rôles / permissions

Le modèle RBAC existe (roles/permissions/role_permissions) mais aucune action fiscale n'est gated aujourd'hui (envoi facture, suppression = connecté + état workflow seulement). v1 : l'avoir suit le même régime, **pas de gate spécifique**. Restriction possible plus tard via un slug `quotes.avoir` + middleware `requirePermission` (net-new, non fait ici).

## 12. Invariants à préserver

1. `acompte + solde = total` à la centime (helpers `computeDepositAmounts`/`computeBalanceTtc`).
2. `avoir TTC = ancien total effectif − nouveau total effectif` (mesuré après recalcul).
3. Somme des lignes = total stocké (ne pas re-arrondir les lignes déjà arrondies).
4. Respect de `price_entry_mode` (HT/TTC) pour toute réduction de ligne.
5. Extras exclus de `quotes.total_ttc`, réintégrés via le total effectif.
6. `round2` seul primitif d'arrondi (pas de `Math.ceil`/`floor`/`toFixed` ; ne pas réutiliser `src/lib/price.ts:deriveHtFromTtc` qui `floor`).
7. Les deux copies de `quote-rounding.ts` restent synchronisées.
8. L'avoir n'écrit jamais dans `payments`.

## 13. Angles morts / cas limites

- **Paiement manuel invisible aux timestamps** : `deposit_paid_at`/`status` ne sont pas remplis par un paiement manuel. → lire le registre (`getPaidDeposits`/`getRemainingBalance`), jamais les timestamps, pour le freeze et l'affichage.
- **`bookings.restaurant_id` nullable** : compteur AV retombe au niveau org.
- **Devis déjà entièrement soldé** : `overpaidTtc > 0`, affiché seulement, pas de remboursement (décision).
- **Crédit partiel + arrondi** : le "montant tapé" peut se matérialiser à ±1 centime ; le delta-rule (§5.4) garde l'avoir cohérent.
- **Plusieurs avoirs sur un même devis** : supporté (plusieurs lignes `credit_notes` par `quote_id`) ; chaque avoir figé et numéroté indépendamment.
- **Ré-édition d'un devis engagé** : le figeage de l'acompte (§9) protège contre la dérive.

## 14. Hors périmètre (v1)

- Renumérotation séquentielle des factures (`FAC`).
- Remboursement automatisé (Stripe/virement).
- Fix groupé du stockage devis/factures (écrasement/doublon existants).
- CGV d'avoir éditables par devis.
- Gate de permission spécifique à l'avoir.
- Édition/suppression d'un avoir émis.

## 15. Impact prod / migrations / déploiement

- Migrations SQL : `credit_notes`, `credit_note_items`, `document_counters`, RPC `next_document_number` + `create_credit_note`, ajouts `documents` (`doc_kind`, `credit_note_id`), RLS org-scopée sur les nouvelles tables.
- Régénérer les types Supabase après migration.
- **Aucune reprise de données en masse** : le figeage de l'acompte est paresseux (au moment de l'avoir), donc marche sur ancien et nouveau. Le durcissement §9 n'affecte que les paiements futurs.
- Multi-tenant : compteur, RPC et RLS à tester (pas de fuite entre orgs/restaus).
- Chemin chaud modifié : §9 (paiement d'acompte) — tester Stripe + manuel.

## 16. Fichiers touchés (index)

Backend
- `backend/src/lib/pdf-generator.ts` — type `avoir`, labels, branche PDF.
- `backend/src/routes/quotes.ts` — endpoint `POST /:id/credit-note`, download PDF avoir, `recalculateQuoteTotals`.
- `backend/src/lib/quote-rounding.ts` — helper `effectiveTtc`, logique réduction de ligne.
- `backend/src/routes/webhooks.ts` — figer l'acompte au paiement (§9).

Frontend
- `src/features/reservations/lib/quote-rounding.ts` — copie iso des helpers.
- `src/features/reservations/lib/booking-totals.ts` — total effectif / réutilisation.
- `src/features/reservations/hooks/use-quotes.ts` — hook `useCreateCreditNote`, `useCreditNotesByQuote`.
- `src/features/reservations/hooks/use-bookings.ts` — figer l'acompte au paiement manuel (§9).
- `src/features/reservations/components/booking-detail.tsx` — item menu, dialogue sélection, confirmation, sous-carte Avoirs, récap solde, badge type Fichiers.
- nouveau composant `credit-note-dialog.tsx` (sélection + confirmation).

Base de données
- `supabase/migrations/2026XXXX_credit_notes.sql` et suivantes.
- `src/lib/supabase/types.ts` — régénéré.
