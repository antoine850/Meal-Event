# Refonte du design de la fiche de fonction (template BPP)

Date : 2026-07-28. Statut : design validé, à planifier.

## Objectif

Remplacer la mise en page actuelle du PDF « fiche de fonction » par le design
fourni par le client (`fiche-fonction-podium_2 (1).html`) : identité de marque
(wordmark groupe, logo restaurant, fonte IvyOra Display), blocs numérotés avec
filets, grille « essentiel », bandeau allergies, bloc signature + CGV. Tous les
champs affichés aujourd'hui restent, à une exception décidée : la facturation
passe en TTC seul (décision 3), la ventilation HT/TVA disparaît.

## État actuel

- PDF généré côté backend par `backend/src/lib/fiche-fonction-pdf.ts` (pdfmake,
  Roboto uniquement, aucune image), servi par
  `POST /api/bookings/:id/fiche-fonction-pdf` (`backend/src/routes/bookings.ts`)
  qui versionne le document dans le storage.
- Mécanique de saut de page déjà réglée : `unbreakable` sur les petits blocs,
  `dontBreakRows` + `keepWithHeaderRows` sur les tables, `pageBreakBefore`
  anti-orphelin des titres de section, champs TEXT longs volontairement
  sécables (pdfmake tronque un bloc insécable > 1 page).
- L'écran React (`src/features/reservations/components/fiche-fonction.tsx`)
  affiche les mêmes données ; il n'est pas concerné par cette refonte.
- Le template client est un HTML A4 print avec en base64 : 3 graisses IvyOra
  Display (TTF 700, 500, 400 italic), le wordmark groupe (PNG) et un logo
  restaurant (JPEG). Seuls `{{commercial_*}}` et `{{adresse_resto}}` y sont
  balisés ; le reste est des données d'exemple en dur.
- Données disponibles : `organizations.logo_url` (wordmark),
  `restaurants.logo_url/color/address/postal_code/city`, `users.phone/email`
  pour le commercial, `bookings.status_id` → `statuses(name, color)` (absent du
  select actuel de `fetchBookingFullData`), champs menu texte libre
  (`menu_aperitif/entree/plat/dessert/boissons`).

## Décisions (validées)

1. **Remplacement** : le nouveau design remplace la fiche actuelle (PDF
   uniquement, l'écran ne bouge pas).
2. **Aucune perte de champ** : société, espace, contact sur place,
   commentaires, instructions spéciales, commentaires facturation,
   prestations souhaitées, suivi commercial complet, multi-acomptes avec
   statut, pagination et heure d'impression sont conservés.
3. **Facturation 100 % TTC** : plus de ventilation HT / TVA 10 / TVA 20, plus
   de split Prestations/Food ni de PU par ligne. Une seule liste de lignes
   (nom + description en petit, qté, montant TTC), total TTC, une ligne par
   acompte (payé / en attente), solde.
4. **Menu = texte libre** : grille Apéritif / Entrée / Plat / Dessert alimentée
   par les champs texte existants (tiret si vide). Pas de quantités par plat
   (les ×N du template sont de l'invention de maquette). Boissons garde son
   bloc dédié.
5. **CGV en dur** : texte du template repris tel quel dans le code.
6. **Entête client complète** : bloc 01 avec cartes Client référent, Société,
   Commercial, Contact sur place. Pas d'adresse de facturation / SIRET / TVA.

## Structure de page

Dans l'ordre, style template (blocs numérotés `01`, titres majuscules
letter-spaced, filets, valeurs en serif) :

1. **Topstrip** : wordmark groupe (`organizations.logo_url`) à gauche,
   « Pôle Événementiel » à droite. Si pas de logo org, l'image est omise
   (ops : uploader le wordmark extrait du template dans les réglages org prod).
2. **Masthead** : logo restaurant (`restaurants.logo_url`, coins carrés —
   pdfmake ne fait pas d'arrondi), tag « L'établissement », nom du restaurant
   en IvyOra ; à droite « Fiche de fonction », RÉF (format `formatBookingId`
   actuel), badge statut (`statuses.name` sur fond `statuses.color`).
3. **Grille essentiel** (4 colonnes) : Date, Arrivée (« jusqu'à HH:MM » en
   sous-ligne), Invités (`guests_count` pax + nom du contact), Occasion
   (+ Source en sous-ligne).
4. **Bloc 01 Client & contacts** : cartes Client référent (nom, tél, email),
   Société (nom du compte), Commercial (premier de `assigned_user_ids` : nom,
   tél, email), Contact sur place (nom, tél, société — carte omise si vide).
5. **Bloc 02 Menu** : grille Apéritif / Entrée / Plat / Dessert (texte libre,
   tiret si vide). Puis bandeau allergies : vert « Aucune allergie déclarée »
   si champ vide, rouge avec le texte sinon.
6. **Bloc 03 Boissons** : `menu_boissons`.
7. **Bloc 04 Mise en place** : espace en première ligne (label Espace), puis
   `mise_en_place`.
8. **Bloc 05 Déroulé** : `deroulement` (le template fusionnait avec la mise en
   place, on garde les deux champs séparés).
9. **Bloc 06 Facturation** (encadré fond crème) : lignes du devis actif
   (sélection `getActiveQuote` inchangée), total TTC, acomptes (payé en vert
   avec montant négatif + réf devis, en attente en gris), solde en couleur
   restaurant.
10. **Blocs texte conservés** : Commentaires facturation (`internal_notes`),
    Commentaires (commentaires + instructions spéciales — le contact sur place
    n'y est plus concaténé puisqu'il a sa carte), Prestations souhaitées.
11. **Bloc Suivi commercial** : commerciaux assignés (liste complète), relance,
    option, budget client, date signature devis. Occasion et source ne sont pas
    dupliqués (déjà dans la grille essentiel).
12. **Bloc Signature** : texte CGV du template en dur, « Bon pour accord · le
    client », mention manuscrite, zone de signature, champs Fait à / Le /
    Signature.
13. **Footer chaque page** : nom + adresse restaurant à gauche
    (`address, postal_code city`), « Émis le <date> à <heure> · Page X/Y » à
    droite.

## Technique

- **Fontes** : extraire les 3 TTF IvyOra du HTML client vers
  `backend/src/assets/fonts/` et les déclarer dans `pdf-generator.ts` comme
  famille `IvyOra` (normal→500, bold→700, italics→400 italic,
  bolditalics→700). Roboto reste la fonte par défaut (sans-serif). Les rôles
  « mono » du template (réf, montants) restent en Roboto.
- **Images** : fetch HTTP des `logo_url` (org + restaurant) au moment de la
  génération, converties en data URL pour pdfmake. Échec réseau ou URL vide →
  image omise, le PDF sort quand même (boundary externe, try/catch justifié).
- **Couleur d'accent** : `restaurants.color` (fallback actuel conservé). Le
  template ne se sert visuellement que de la couleur primaire.
- **Fetch** : ajouter `status:statuses(name, color)` au select de
  `fetchBookingFullData`, et le fetch du logo org via `organization_id`.
- **Sauts de page** : réutiliser la mécanique existante. Insécables : grille
  essentiel, bandeau allergies, cartes contacts, bloc signature, chaque ligne
  de facturation (`dontBreakRows`). Sécables : textes libres longs (menu,
  mise en place, déroulé, commentaires). Titres de bloc jamais orphelins
  (`headlineLevel` + `pageBreakBefore` existants). Footer pdfmake sur toutes
  les pages (le footer flex du template ne se répète pas, on garde le
  comportement pdfmake).
- **Styles** : letter-spacing des labels majuscules via `characterSpacing`.

## Hors périmètre

- L'écran React de la fiche (onglet du détail de réservation).
- Toute donnée structurée de menu avec quantités (formulaires menus).
- Configuration des CGV (en dur ; configurable plus tard si demandé).
- Variante « interne » vs « client signé » du document (à retraiter si le
  client le demande — le doc signé contiendra les infos internes conservées).
- Upload du wordmark dans l'org prod (étape ops, hors code).
