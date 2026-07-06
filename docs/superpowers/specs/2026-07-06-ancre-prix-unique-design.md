# Ancre de prix unique par ligne (devis + catalogue) — Design

Date : 2026-07-06
Statut : validé (brainstorm), prêt pour plan

## 1. Contexte et objectif

L'audit du 06/07 (devis SPLASH-2026-07-qpem-v1 : 639,76 affiché vs 16 × 39,99 = 639,84 attendu) a montré
que trois philosophies de prix coexistent : stockage verbatim double-ancre (spec du 01/07), dérivation
HT<->TTC aux blurs (rétablie par d077af7, contraire à la spec), et catalogue ancré HT flooré avec TTC
en colonne générée. Les incohérences sont les frictions entre ces trois modèles. La recherche de
bonnes pratiques (fact-checkée : EN 16931/Factur-X, Odoo, Stripe, Shopify, Pennylane) converge sur un
modèle unique : **une ancre de prix par ligne + un mode (TTC inclus / HT exclu) + un taux ; l'autre
côté est toujours dérivé, jamais stocké comme seconde vérité indépendante.**

Objectif : appliquer ce modèle partout (devis, catalogue), sans gel bloquant (décision : les devis
restent modifiables à tout moment), en supprimant toute mutation silencieuse, et avec une recette
chiffrée avant/après.

## 2. Modèle cible

### Ligne de devis
- `price_entry_mode` désigne **l'ancre** : `'ttc'` (défaut pour toute nouvelle ligne) ou `'ht'`.
- Le champ ancré (`unit_price_ttc` ou `unit_price`) est ce que le commercial a tapé. L'autre champ
  devient un **cache dérivé**, recalculé par la lib à l'écriture, jamais saisi indépendamment.
- Écriture d'une ligne (`computeLineAmounts`, plus de branche verbatim double-ancre) :
  - total côté ancre = `round2(qty × PU_ancre − remise)` (la remise s'applique côté ancre) ;
  - l'autre total dérivé via `tva_rate` ; PU dérivé = `round2(PU_ancre ×/÷ (1 + taux/100))` ;
  - TVA de ligne = `total_ttc − total_ht` (inchangé).
- Lecture = **stocké partout** : éditeur, preview, PDF, listes affichent `total_ht/total_ttc` de
  ligne et `quotes.total_*` stockés. Les lignes existantes non touchées (BS, historiques, taux
  mélangés) gardent leurs montants à vie.

### Totaux du devis
- `quotes.total_*` = somme des `total_*` **stockés** des lignes produits × (1 − remise globale/100)
  (extras hors total, comportement actuel conservé). `recalculateQuoteTotals` (front + back) somme
  les totaux stockés au lieu de repasser toutes les lignes par `computeLineAmounts` : éditer la
  ligne X ne recalcule que X, puis re-somme. Désamorce la mine BS (2 144 devis) sans rien geler.
- Changer la remise globale déclenche le recalcul des `quotes.total_*` (fix du bug : aujourd'hui
  `saveAllFields` n'écrit que `discount_percentage` et le backend facture sur des totaux périmés).

### Édition (quote-editor)
- **Toggle TTC | HT par ligne** : un seul champ prix actif (celui du mode), l'autre affiché grisé en
  lecture seule (dérivé). Basculer le toggle convertit sans changer les montants : la nouvelle ancre
  prend la valeur dérivée courante, les totaux ne bougent pas au moment de la bascule.
- **Aucune écriture sans modification réelle** : tous les blurs (PU, quantité, remise de ligne,
  TVA) comparent à la valeur courante avant de muter. Fin des focus+blur qui changent la base et du
  round-trip lossy de la remise (10,00 € -> 1,7 % -> 9,89 €).
- Inputs prix/remise en **état contrôlé** (fin des `defaultValue` + remount par `key`) : corrige la
  perte de saisie enchaînée et les mutations concurrentes.
- Taux de TVA : sélecteur limité aux taux légaux {0 ; 2,1 ; 5,5 ; 10 ; 20} (garde `normalizeTvaRate`
  conservée). Changer le taux : l'ancre tient, l'autre côté se re-dérive.
- Devis signé / payé / importé BS : **modifiable** (décision), mais la première modification de la
  session affiche une confirmation explicite (« ce devis est signé/payé, modifier changera le
  solde »). Pas de blocage, pas de versionnement imposé.

### Catalogue (products)
- `products.unit_price_ttc` passe de colonne **générée** à vraie colonne ; nouvelle colonne
  `price_entry_mode` (`'ttc'` défaut). Le formulaire produit reçoit le **même toggle TTC | HT** :
  le prix tapé est stocké verbatim côté ancre, l'autre côté affiché dérivé. Suppression du floor
  `deriveHtFromTtc` (src/lib/price.ts) : dérivation en `round2` comme les devis.
- « Enregistrer une ligne au catalogue » transmet ancre + mode + taux de la ligne.
- Insertion dans un devis (catalogue, produit manuel, extra) : copie ancre + mode + taux. Les
  packages n'ont pas de prix TTC : insertion en mode `'ht'` (inchangé, hors périmètre d'ajouter le
  TTC aux packages). Le prix de la ligne reste un snapshot : modifier le produit au catalogue ne
  touche jamais les devis existants.
- Import produits (import-products.mjs) : stocke ancre TTC + mode `'ttc'` (comportement actuel
  normalisé), garde `normalizeTvaRate`.

### Affichage des documents (preview + PDF)
- La preview lit les totaux stockés (recalcul uniquement en secours si NULL) : parité totale avec le
  PDF, qui lit déjà le stocké. Le PDF cesse de rétro-dériver le sous-total avant remise (lecture de
  la somme des lignes stockées).
- **PU adaptatif** : 2 décimales par défaut, étendu à 3-4 uniquement quand la valeur exacte l'exige
  (lignes historiques, ex. 39,985) — `qty × PU affiché = total` devient exact sur 100 % des lignes.
  Décision validée. Licite (aucune limite légale de décimales sur le PU ; EN 16931 idem).

### Backend
- `PATCH /api/quotes/:id` et `POST /api/quotes` : whitelist des champs ; `total_*` jamais écrits
  par le client, toujours recalculés serveur (somme des stockés).
- `send-balance` : `balanceAmount` passé par `round2` (parité front `computeBalanceTtc`).
- Les deux copies de `quote-rounding.ts` restent isomorphes (tests de parité).

## 3. Données (migration + scripts)

1. Migration SQL `products` : `unit_price_ttc` générée -> réelle (initialisée à la valeur générée
   actuelle), + `price_entry_mode` défaut `'ttc'`. Régénérer les types Supabase.
2. Script ciblé (dry-run + snapshot, comme les précédents) :
   - ~76 lignes sans `unit_price_ttc` (insertions catalogue récentes, dont SPLASH) : ré-ancrage
     optionnel sur le TTC catalogue (matching produit par restaurant + nom), **limité aux
     brouillons**, liste soumise avant application ; les autres restent telles quelles ;
   - 4 lignes natives mode `'ttc'` remisées dont la remise a été appliquée côté HT : recalcul.
3. **Aucune réécriture massive.** Les 646 lignes à PU 4 décimales restent (couvertes par le PU
   adaptatif). Les ~30 devis BS dont le header diverge de la somme des lignes sont **listés dans le
   rapport de recette** pour arbitrage manuel (le header est le CA facturé BS, pas d'auto-fix).

## 4. Invariants

1. Lecture = stocké, partout (éditeur, preview, PDF, listes, dashboard).
2. Écriture d'une ligne : ancre -> les deux PU et les deux totaux persistés cohérents ; total devis
   = somme des totaux stockés. `qty × PU_ancre − remise = total_ancré` sur toute ligne écrite par
   l'app.
3. Aucune écriture sans modification réelle ; aucun montant d'une ligne non touchée ne change.
4. HT + TVA = TTC par ligne (TVA = TTC − HT). Acompte + solde = total (inchangé).
5. Les deux copies de `quote-rounding.ts` restent identiques au code près.

## 5. Recette et tests

- Script de recette **lecture seule** exécuté avant/après (et rejouable) : (a) lignes où
  `qty × PU_ancre − remise ≠ total_ancré` (attendu : population stable sur les lignes non touchées,
  zéro sur toute ligne écrite après le refactor) ; (b) devis où `header ≠ somme des lignes stockées`
  (attendu : uniquement les ~30 connus) ; (c) parité preview/PDF sur échantillon ; (d) populations
  résiduelles connues (PU >2 décimales, taux non légaux — chantier séparé).
- Tests unitaires : `computeLineAmounts` mono-ancre (ttc/ht, remise, bascule), somme des stockés,
  parité des 2 copies ; tests handlers éditeur (garde de comparaison, toggle) ; tests backend
  (whitelist, recalcul remise globale).

## 6. Risques

- **Bascule d'ancre** : convertir puis rebasculer peut décaler d'un centime (asymétrie HT/TTC).
  Mitigé : la bascule reprend la valeur dérivée courante sans recalcul des totaux ; seul un nouveau
  prix tapé change les montants.
- **Lignes à taux non légal rééditées** (393 placeholders BS) : le taux mélangé reste jusqu'au
  chantier TVA (audité 06/07 : 398 lignes / 397 devis, produits sains). Le sélecteur de taux légaux
  pousse à corriger à la réédition.
- **Changement d'habitude** : le champ dérivé n'est plus éditable directement (il faut basculer le
  toggle). Communication aux commerciaux nécessaire.
- **Migration colonne générée -> réelle** : vérifier les dépendances (types générés, vues éventuelles).
- Modifier un devis signé/payé reste possible (décision assumée) : l'avertissement est la seule garde.

## 7. Hors périmètre

- Normalisation des `tva_rate` non légaux (chantier différé, chiffré le 06/07).
- Export Factur-X / EN 16931 (échéance émission PME sept. 2027) — le modèle cible le prépare.
- Prix TTC sur les packages ; workflow d'avoir (conservé tel quel) ; versionnement des devis.

## 8. Fichiers touchés (index)

- Lib : `src/features/reservations/lib/quote-rounding.ts` + copie backend (mono-ancre, somme des
  stockés) ; `src/lib/price.ts` (suppression `deriveHtFromTtc`).
- Frontend : `quote-editor.tsx` (toggle, gardes, inputs contrôlés, avertissement), `quote-preview.tsx`
  (lecture du stocké, PU adaptatif), `use-quotes.ts` (insertion ancre+mode+taux,
  `recalculateQuoteTotals`, remise globale), `product-dialog.tsx`, `save-to-catalog-dialog.tsx`.
- Backend : `routes/quotes.ts` (whitelist, recalcul, round2 solde), `lib/pdf-generator.ts`
  (sous-total remise, PU adaptatif).
- Data : migration `products`, script ciblé (brouillons + 4 remises), script de recette.

## 9. Impact prod

- 1 migration SQL (`products`), types Supabase à régénérer. Aucun recalcul massif de devis.
- Front + back à déployer ensemble (lib isomorphe modifiée des deux côtés).
- Changement visible : toggle sur lignes et formulaire produit, PU 3-4 décimales sur certaines
  lignes historiques, confirmation à la modification d'un devis engagé.
