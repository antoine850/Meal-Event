# Réconciliation Booking Shake ⟷ MealEvent

Journal de traçabilité. **Statut : analyse en lecture seule -- aucune écriture en base à ce stade.**
Date de départ : 2026-06-30.

## Contexte

MealEvent a été peuplé depuis un export BS daté (~début juin). Depuis, BS a évolué ET les équipes
travaillent dans MealEvent depuis ~5 mois (donc des deux côtés). On veut réconcilier sans casser le
travail fait dans ME.

## Exports utilisés (BS frais, 2026-06-30)

Le user a fourni 4 fichiers ; 2 paires de doublons (md5 identiques) :
- **Events frais** : `document (7).csv` = `document (5) (1).csv` -- ~14 184 events. Nouvelle colonne
  `quote_signature_date`. Contient le `bookingId` Firestore dans la colonne "0_Fonction Complète".
- **Facturation fraîche** : `document (8).csv` = `document (6) (1).csv` -- ~6 290 factures
  (acompte/solde/facture + avoirs), avec ventilation TVA par taux (`HT10/HT20/TVA10/TVA20...`).
- Anciens exports de référence : `document (1).csv` (events ancien), `document (3)/(4).csv`
  (facturation ancienne).
- Récolte web du 30/06 : `bs_devis_links_full.json` -- 4019 devis (URL PDF + statut/montant/date),
  non-annulés (En attente + Validé). Sert à l'enrichissement des lignes de devis.

## Modèle de source de vérité (merge 2 sens, PAS un écrasement BS)

| Population | Règle |
|---|---|
| Event BS-sourced, statut modifié | BS gagne **seulement si plus avancé** dans le pipeline ; sinon on protège ME |
| Records **ME-natifs** (`external_source` vide) | **ME gagne** -- BS ne les connaît pas, intouchables |
| Facturation | **2 sens** : factures BS absentes de ME → importer ; billing ME-natif → garder |
| Events disparus de BS | **ne rien supprimer** -- noter et traiter après vérification |

Ordre des statuts (rang pipeline) : Nouveau(1) < Qualification(2)/Report < Proposition(3) <
Négociation(4) < Confirmé/Fonction à faire(5) < Fonction envoyée(6) < A facturer(7) <
Attente paiement(8) < Relance paiement(9) < Cloturé(10). `Annulé` = terminal à part.

## Constats (lecture seule)

### Records ME-natifs (créés dans ME, pas via BS) -- À PROTÉGER
- bookings : **1 688** | devis : **681** | paiements : **163** (`external_source` vide).
- Confirmé métier réel (équipes sur ME depuis ~5 mois). Jamais écrasés/supprimés par la synchro.

### Events
- BS frais 14 184 | ME bookings BS-sourced 14 165 | ME-natifs 1 688.
- **Nouveaux (BS pas dans ME) : 134** -- majoritairement récents (80 dates futures ; 121/134 créés
  dans BS depuis le 25-05). Fichier : `nouveaux_events.csv`.
- **Disparus (ME BS-sourced absents du frais) : 115** -- 100% étaient dans l'ancien export, bookingId
  absent du frais → **supprimés/archivés dans BS**. Statut ME : 62 Annulé, 35 Qualif, 14 Propo,
  3 Confirmé, 1 Cloturé. ⚠️ Les **53 actifs** sont à vérifier (vraies suppressions ou filtre
  d'export ?). Fichier : `disparus.csv`. **Décision : ne rien supprimer dans ME pour l'instant.**

### Statuts (events BS-sourced communs, vs ME-live)
- **BS plus avancé → à appliquer : 236** (`statuts_BS_avance_APPLIQUER.csv`).
- BS = Annulé, ME actif : **261** → décision manuelle (`statuts_BS_annule.csv`).
- **ME plus avancé → à protéger : 8** (`statuts_ME_avance_PROTEGER.csv`).
- ME = Annulé, BS actif (à rebours) : **10** → revue (`statuts_reverse_ME_annule.csv`).

### Montants facturés
- Évolution BS (ancien vs frais) : **129 events** ont bougé, **+403 557 € net** (70 nouvellement
  facturés +276k, 53 augmentés +157k, 4 diminués, 2 passés à 0). `evolution_facturation_BS.csv`.
- BS-frais vs ME-live, events **facturés** : **133 écarts**, net -34k € (77 BS>ME = devis ME
  sous-évalué, 56 BS<ME). `ecarts_montant_BSfrais_vs_MElive.csv`.
- Events forecast (devis ME mais BS pas facturé) : **1052**, -9,38M € = **gap de reconstruction
  flat-10%** (connu) → corrigé via l'enrichissement des lignes de devis (récolte 4019).

### Paiements (statut acompte/solde)
- **124 events** où BS a encaissé plus que ME (nouveaux acomptes/soldes payés depuis l'import) ;
  2 inverse. `ecarts_paiement.csv`.

### Facturation -- 2 sens
- BS facturé + devis ME : 2122 | BS facturé **sans** devis ME : **43** (à créer dans ME,
  `factures_BS_sans_devis_ME.csv`) | devis ME sans facture BS : 1052 (forecast) | devis ME-natifs : 681.

## Décisions prises
- **Aucune suppression/annulation pour l'instant.** Les disparus et annulations sont notés, traités après.
- Records ME-natifs (1688/681/163) : protégés.
- Comparaisons statuts & paiements faites vs **ME-live (Supabase)**, pas l'ancien export.

## À traiter (après validation)
1. **53 disparus actifs** : vérifier dans BS (suppression réelle vs filtre export). Ne rien supprimer avant.
2. **261 annulations** BS : décider si on les applique dans ME.
3. **10 cas à rebours** + **8 ME-en-avance** : revue/protection.
4. **236 statuts BS-avancé** : appliquer (snapshot avant écriture).
5. **134 nouveaux events** : importer dans ME.
6. **43 events facturés sans devis ME** : créer devis/paiements.
7. **133 écarts de montant** + **124 nouveaux paiements** : synchroniser.
8. **Gap de reconstruction (1052 forecast, -9,38M)** : remplacer les placeholders par les vraies
   lignes de devis (parsing des 4019 PDF récoltés).

## Compléments (suite 30/06)

### Disparus → filtre de date à l'export (PAS des suppressions)
L'export events frais est plafonné à `date_event` <= 2026-12-26 ; l'ancien allait à 2028-05-13.
**51 des 53 disparus actifs ont une `date_event` au-delà de 2026-12-26** -> events futurs exclus par
le filtre d'export, pas supprimés. 2 seulement sont dans la fenêtre (deep-link BS = erreur appli
générique, non concluant -> vérif manuelle). **Action : ré-exporter les events sans cap de date
(étendre à 2028+). Ne rien supprimer dans ME.**

### Annulations 261 : sûres
0 des 261 events à annuler n'a de paiement dans ME -> aucun garde-fou déclenché, application sûre.
Rapport : `rapport_annulations_261.csv`. Conflits 18 : `rapport_conflits_18.csv` (pour l'équipe).

### Règle d'arrondi : `src/features/reservations/lib/quote-rounding.ts` (+ `backend/src/lib/quote-rounding.ts`)
Règle métier : **chaque ligne TTC = `Math.ceil` à l'euro entier**, total TTC = `ceil(somme × (1-remise))`,
HT/TVA dérivés du TTC arrondi. Racine de l'audit arrondi (+1,27M à la ré-édition).
- Enrichissement = stocke les valeurs **exactes** du PDF BS + cale le total sur BS -> juste au repos.
- MAIS ré-édition d'un devis importé à lignes décimales -> `computeQuoteTotals` re-`ceil` par ligne
  -> total gonflé vs BS. **Décision à prendre** : (a) garder euro-entier, (b) changer la règle
  (impacte les 681 devis ME-natifs, risqué), (c) cas particulier devis importés (préserver l'exact).
  Reco : (c). Explique aussi une partie des écarts de montant (totaux ME `ceil`és > BS).

## Données & scripts (session)
- Récolte devis : `~/Downloads/bs_devis_links_full.json` (4019).
- Rapports CSV : `scratchpad/recon_report/`.
- Scripts d'analyse : `scratchpad/recon1..4.py`, `elucide.py` (lecture seule).
