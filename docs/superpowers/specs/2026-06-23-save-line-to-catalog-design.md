# Enregistrer une ligne de devis au catalogue du restaurant

## Contexte

Dans l'éditeur de devis/facture (`src/features/reservations/components/quote-editor.tsx`),
un commercial peut ajouter des lignes "à la main" (nom, prix, TVA libres) en plus des
produits/packages issus du catalogue. Ces lignes manuelles ne sont pas réutilisables : il
faut les retaper à chaque devis. On veut un bouton vert sur chaque ligne pour l'enregistrer
dans le catalogue du restaurant du booking.

## Comportement

- Bouton vert "Enregistrer au catalogue" sur chaque ligne produit (à côté de la corbeille).
- Au clic, ouverture d'un dialogue prérempli depuis la ligne (nom, prix HT, TVA).
- Bascule **Produit / Package** :
  - Produit : catégorie obligatoire (`PRODUCT_TYPES`), case "prix par personne".
  - Package : pas de catégorie, package simple sans produits contenus.
- Restaurant cible = celui du booking (lecture seule), lié via `product_restaurants` /
  `package_restaurants`.
- Confirmation → `useCreateProduct` / `useCreatePackage` avec `restaurant_ids: [restaurant.id]`,
  toast succès, fermeture.

## Implémentation

- Nouveau composant `SaveToCatalogDialog` dans `features/reservations/components/`.
- Réutilise les hooks `useCreateProduct` / `useCreatePackage` de `features/settings`.
- Après succès, invalider explicitement `['products-by-restaurant']` et
  `['packages-by-restaurant']` (les hooks de création n'invalident que `['products']` /
  `['packages']`, pas les clés utilisées par le picker du devis).
- `quote-editor.tsx` : ajout d'un prop `onSaveToCatalog` à `SortableItemRow`, état
  `catalogItem` au niveau de `QuoteEditor`, rendu unique du dialogue.

## Hors périmètre

- Pas de migration DB (tables et hooks existants).
- Pas de déduplication : le bouton est visible sur toutes les lignes, l'utilisateur décide.
- Un package enregistré depuis une ligne n'a pas de produits contenus.
