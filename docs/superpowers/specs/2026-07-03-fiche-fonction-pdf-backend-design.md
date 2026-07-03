# Fiche de fonction : génération PDF côté backend (pdfmake)

Date : 2026-07-03. Statut : design validé, à planifier.

## Problème

La fiche de fonction est le **seul document encore généré côté navigateur** via `html2pdf.js`
(`fiche-fonction-pdf-button.tsx`). html2canvas rasterise le DOM en une image unique, jsPDF la
découpe en tranches A4 à hauteur de pixels : il n'y a pas de vraie pagination, donc des sections
et lignes de texte sont **coupées en plein milieu** au saut de page. C'est structurel, aucun
réglage `pagebreak` ne le garantit (le mode `avoid-all` a déjà été retiré car il tronquait
silencieusement des cartes, cf. commentaire `fiche-fonction-pdf-button.tsx:276`).

Fragilités associées : snapshot de ~75 propriétés CSS par élément, conversion oklch via canvas,
police forcée, grilles px→fr, U+202F remplacé -- chaque mise à jour Chrome/Tailwind peut casser.
Le PDF produit est une image : lourd, flou, non sélectionnable.

Les devis/acomptes/soldes/avoirs sont déjà générés backend avec pdfmake (vraie pagination
vectorielle). L'export devis client-side a été migré vers le backend (commit c95428f) ;
la fiche de fonction est restée sur l'ancien chemin.

## Décisions actées

- Mise en page **dédiée impression** (pas de copie pixel de l'écran), style cohérent avec les
  documents existants : Roboto 9pt, accent `restaurant.color` sur titres de section et en-têtes
  de tableaux, lisible en N&B.
- Génération, versioning et upload passent **côté serveur**. L'écran ne change pas.
- Écarter print CSS (`window.print`, perd l'upload versionné) et Puppeteer (deuxième stack PDF,
  infra lourde).

## Backend

### Fetch

`fetchBookingFullData(bookingId)` dans `pdf-generator.ts`, sur le modèle de `fetchQuoteFullData`
mais centré booking : select service-role `bookings` + `contact(company)` + `restaurant` +
`quotes(quote_items)` + `payments`, plus lookups noms des commerciaux (`assigned_user_ids`) et
nom de l'espace (`space_id`).

Les helpers purs de l'écran (`getActiveQuote` priorité statuts, `computeVatBreakdown`,
reste à payer, prorata HT/TVA des acomptes -- `src/features/reservations/lib/booking-totals.ts`
et `fiche-fonction.tsx:226-265`) sont **dupliqués côté backend** (~50 lignes, même compromis que
les formatters). Split des tables identique à l'écran : Food = `tva_rate === 10`, Prestations =
le reste ; acomptes = paiements `payment_modality='acompte'` ou `payment_type='deposit'`,
payés et en attente.

### Doc definition

`buildFicheFonctionDocDefinition(data)` **dédiée** (pattern avoir, pas de branche dans le
`buildDocDefinition` monolithique). Sections dans l'ordre de l'écran (`fiche-fonction.tsx:328-786`) :
en-tête (titre, date d'impression, établissement, identifiant = `formatBookingId`), horaires,
compte/contact/coordonnées, tables Prestations et Food (7 colonnes), Totaux, Acomptes, Reste,
commentaires facturation (`internal_notes`), espace/couverts, mise en place, déroulé, menu
2 colonnes, allergies/prestations souhaitées, commentaires combinés (+ instructions spéciales,
contact sur place), suivi commercial.

Pagination par construction :
- tables d'items : `headerRows: 1` + `dontBreakRows: true` ; description d'item dans un `stack`
  de la cellule Titre (comme le devis) → solidaire de sa ligne
- petits blocs (Totaux, Acomptes, Reste, Suivi commercial, cartes d'infos) : `unbreakable: true`
- textes libres longs : coulent sur plusieurs pages ; `pageBreakBefore` + `headlineLevel` pour
  éviter les titres orphelins en bas de page
- footer répété : « Page X/Y -- Fiche de fonction #id -- imprimé le date »

### Route et persistance

`POST /api/bookings/:id/fiche-fonction-pdf` dans `routes/bookings.ts` (montage `requireAuth`
existant). Le backend calcule le prochain N (« Fiche de fonction vN » via la table `documents`,
même regex qu'aujourd'hui), génère, uploade vers
`${orgId}/bookings/${bookingId}/fiche-fonction-vN.pdf`, insère la ligne `documents`, répond
`{ fileUrl, fileName, version }`.

`savePdfAsDocument` (aujourd'hui dans `routes/quotes.ts:58`, chemin `quotes/` codé en dur) est
déplacé dans `backend/src/lib/documents.ts` avec le chemin en paramètre. **Différence avec le
flux email : les erreurs d'upload/insert font échouer la requête** (la ligne `documents` est le
livrable), pas de best-effort avalé.

## Frontend

`fiche-fonction-pdf-button.tsx` réduit à : flush de la note de facturation en cours (await de la
mutation `useUpdateBooking` avant génération -- le textarea sauvegarde au blur, risque de version
périmée sinon), POST authentifié, téléchargement depuis `fileUrl` (blob + ancre desktop,
`window.open` iOS -- conserver les deux quirks Safari existants), toast, invalidation query
`documents`.

Nettoyage : suppression de `quote-pdf-export.tsx` (mort depuis c95428f) et de `html2pdf.js` du
`package.json` (plus aucun consommateur). Les variantes Tailwind `print:` de l'écran restent
(Ctrl+P navigateur).

## Erreurs et cas limites

- Booking sans devis actif : carte « Aucun devis associé » comme l'écran.
- Champs vides : mêmes absences/tirets que l'écran.
- Erreur génération/upload : 500, rien persisté, toast côté client.
- Scoping org : statu quo des routes quotes (JWT requis, pas de check org) -- durcissement
  éventuel = chantier séparé toutes routes PDF.

## Limites assumées

- Le PDF ne ressemble plus pixel pour pixel à l'écran (acté).
- Tout futur champ de la fiche est à ajouter à deux endroits : écran + doc definition.

## Périmètre fichiers

`backend/src/lib/fiche-fonction-pdf.ts` (nouveau : fetch + build + génération, pdf-generator.ts
fait déjà 2484 lignes), `backend/src/lib/pdf-generator.ts` (export `renderPdfToBuffer`),
`backend/src/lib/documents.ts` (nouveau),
`backend/src/routes/bookings.ts` (route), `backend/src/routes/quotes.ts` (import du helper
déplacé), `src/features/reservations/components/fiche-fonction-pdf-button.tsx` (réécrit),
`src/features/reservations/components/quote-pdf-export.tsx` (supprimé), `package.json`
(html2pdf.js retiré).

## Vérification

Pas de suite de tests backend : vérification manuelle ciblée. Booking chargé (nombreuses lignes
avec descriptions, déroulé/menu longs) → PDF 3+ pages : aucune ligne ni carte coupée, en-têtes de
tableaux répétés, totaux/acomptes/reste identiques à l'écran, versioning vN incrémenté, ligne
`documents` créée, téléchargement OK desktop + iOS.
