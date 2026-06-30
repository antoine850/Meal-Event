# Booking Shake ⟷ MealEvent — Plan d'exécution (v2, corrigé)

Réécrit le 2026-07-01 après audit complet (données prod + code) et revue du plan contre les 5 objectifs.
Trace/analyse détaillée : [booking-shake-reconciliation.md](booking-shake-reconciliation.md).

## But

MealEvent (ME, prod) a été peuplé depuis un export Booking Shake (BS, l'ancien CRM) début juin. Depuis,
les équipes travaillent dans **les deux** systèmes, donc les données ont divergé **des deux côtés**. On
réconcilie BS → ME **sans casser** le travail fait dans ME. Dans ce système, **devis = facture** (même
objet) et **un seul devis par event**.

### Les 5 objectifs (mots du client)
- **G1** — mettre à jour les **statuts** des events avec la dernière update.
- **G2** — remplir les **bons détails de devis/facture** pour ceux qui ont un placeholder.
- **G3** — **facturation juste** : ce qui est encaissé ou non, les bons montants d'acompte et de total,
  pour que la partie facturation soit raccord.
- **G4** — avoir **tous les bons events BS à jour** dans ME.
- **G5** — constituer le **plus petit fichier possible** d'incohérences / cas où la source de vérité est
  inconnue, à donner aux équipes BS pour qu'elles tranchent.

## Modèle de source de vérité (corrigé)

Merge **2 sens**, pas un écrasement BS. Arbitrage **par champ** via `activity_logs` :

- **Records ME-natifs** (`external_source` vide : 1694 bookings / 681 devis / 163 paiements) = **intouchables**.
- **Champ tracé par les logs** (statut, date, couverts) : si un user ME a édité ce champ **après l'import
  (boundary 2026-06-04)** → on ne peut pas l'ordonner contre une éventuelle édition BS → **RÉSIDUEL**
  (équipes). Sinon → la valeur ME vient de l'import → **BS plus récent → BS-AUTO**.
- **Champ NON tracé** (menu, allergies, déroulé, espace, horaires, acompte) : `activity_logs` ne les suit
  pas. "Pas de log" ≠ "ME n'a pas édité". Donc pour ces champs : **ne jamais auto-écraser ME**, toute
  divergence BS≠ME → **RÉSIDUEL**.
- **Statut = "dernière update gagne", PAS "rang le plus avancé"** : la règle de rang ignorait les retours
  en arrière légitimes (deal perdu/rouvert) et mélangeait deux cycles (facturation `A facturer→Cloturé` vs
  paiement `Attente→Relance`). L'arbitre `activity_logs` remplace la règle de rang.
- **Rien supprimé.**

## État actuel (au 01/07/2026)

**La prod a déjà été modifiée** (les docs disaient à tort "rien écrit") :
- 5 vagues `--apply` passées : phase5 (headers), phase6 (lignes 3179→5550), phase7 (relink, orphelins 342→1),
  phase8/9 (28 devis). Snapshots présents ; rollback auto seulement pour phase5.
- **Bug double-TVA corrigé** : l'enrichissement stockait `unit_price` en TTC alors que l'app le traite en
  HT (re-TVA → +1,31M à la ré-édition). Reprice `unit_price = total_ht/quantité` appliqué sur 7097 lignes /
  1325 devis (`reprice_unitprice_ht.py`), inflation ramenée à +3,1k. Headers et ME-natifs intacts. Snapshot
  `backups/reprice_snapshot_20260630_233949.json`.
- **Idempotence enrichissement corrigée** : phase6/8/9 font maintenant DELETE (scopé devis) *avant* insert,
  et stockent le HT via `lib.unit_price_ht()`. Plus de lignes `:pos` orphelines.
- **Arbitre `activity_logs` construit** (`arbiter_activity_logs.py`, lecture seule) — voir ci-dessous.

## L'arbitre `activity_logs` (le pivot G1 + G5)

Passe lecture seule qui compare BS-frais (`document (7).csv`) à ME-live, et tranche par champ. Résultats :

| Axe | Divergences | BS-AUTO (G1) | Résiduel → équipes (G5) |
|---|---|---|---|
| Statut | 515 | 480 | 35 |
| Date | 20 | 19 | 1 |
| Couverts | 70 | 63 | 7 |

- **Fichier minimal d'incohérences** : `backups/arbiter_residual.csv` (**43 lignes**, event/axe/BS/ME/dernier
  éditeur ME/date). C'est le livrable G5 pour les équipes.
- **BS applicable auto** : `backups/arbiter_auto_status.csv` (480), `_auto_date.csv` (19), `_auto_pax.csv` (63).
- Cross-check : 515 statuts = 236 BS-avancé + 261 annulations + 8 ME-avancé + 10 reverse (cohérent avec l'analyse).
- À étendre : axes **montant/acompte** (dès que le total est corrigé, cf. G3) et **champs non tracés**
  (menu/allergies/...) → tout BS≠ME va au résiduel sans auto-apply.

## Garde-fous (à CHAQUE écriture)

1. **Repointer sur les CSV frais d'abord** : `lib.BILLING_CSV`/`EVENTS_CSV` pointent encore vers les VIEUX
   `document (3)/(1)`. Les corriger vers `document (8)/(7)` avant tout apply facturation/enrichissement.
2. **Recalculer + diffé la liste de décision juste avant son `--apply`** (les équipes éditent en continu ;
   une liste du 30/06 peut écraser une modif faite depuis). Toute ligne dont la valeur ME a bougé depuis
   l'analyse → revue, pas auto-apply.
3. **Dry-run** (rapport de ce qui change) → validation → **canary `--limit`** → vérif → apply complet → vérif post.
4. **Snapshot** avant écriture + **un script de restore testé par writer** (aujourd'hui seul phase5 en a un).
5. **Transactionnalité** : l'écriture par devis (DELETE+insert+patch) = 3 appels REST. Soit RPC Postgres
   atomique, soit mono-thread + vérif "lignes > 0" après chaque devis.
6. **Idempotent** (skip déjà fait, clés stables). **Ne jamais toucher `external_source` vide** (ME-natifs).
   **Garder `total_ttc`** (montant facturé/payé réel). **Rien supprimer.**
7. **Invariant post-apply** : pour chaque devis touché, `|Σ lignes_ttc − header_ttc| ≤ tolérance` et lignes > 0.

## Séquence d'exécution (ordre imposé)

0. **[USER] Ré-exporter les events sans cap de date** (→ 2028+) : récupère ~51 futurs + 19. Prérequis dur de G4.
1. **Repointer les scripts sur les CSV frais** (`document (7)/(8)`).
2. **Recalculer toutes les listes de décision** depuis le frais + DB live ; diffé contre l'analyse du 30/06.
3. **G3 — Montants/facturation** : corriger les totaux AVANT d'attacher les paiements (cf. piège ci-dessous).
4. **G2 — Enrichissement** : facture-path (durci) pour les ~47-164 facturés ; **moteur devis-PDF** pour les ~1502 forecast.
5. **G1 — Statuts** : appliquer les 480 BS-auto (+ date 19, pax 63) ; garde anti-annulation (0 paiement ME) maintenue.
6. **G4 — Nouveaux events** : créer les 134 (+ les ~70 futurs après le ré-export).
7. **G5 — Fichier équipes** : consolider tous les résiduels (statut/date/pax + montant + champs non tracés + versions ambiguës + merges) en UN fichier.
8. **Refactor arrondi (Phase 5)** : EN DERNIER, après que la data soit propre.

## Par objectif

### G1 — Statuts
- **Mécanisme** : arbitre `activity_logs` (fait). 480 statuts BS-auto applicables (`bookings.status_id`),
  35 résiduels aux équipes. Date 19 + pax 63 BS-auto.
- **Garde annulation** : avant d'appliquer un BS=Annulé, vérifier 0 paiement ME sur l'event (sécurité
  layered sur l'arbitre).
- **Reste** : étendre l'arbitre au montant/acompte ; recompute au moment de l'apply.

### G2 — Détails devis/placeholder
- **Fait** : double-TVA corrigé, phase6/8/9 durcis (HT + idempotents).
- **Bloquant** : sur 1837 placeholders, **~1502 sont forecast** (pas de facture) et nécessitent le **moteur
  devis-PDF** (`bs_devis_links_full.json`, 4019 devis) — **pas écrit**. Le facture-path ne couvre que ~47-164.
- **Sélection de version** (364 multi-versions) : règle "1 version réconcilie → l'utiliser ; 0 ou ≥2 → ne pas
  écrire, → résiduel". Le gate 2% valide le **total**, pas la **composition** : journaliser la version retenue.

### G3 — Facturation (le risque € le plus élevé)
- **Piège métier** : l'app calcule **reste-à-payer = total_ttc − Σ paiements**. Importer les vrais paiements
  BS sur les ~1502 devis encore au total flat-10% (faux) → soldes faux. **Donc : corriger le total d'abord
  (enrichissement ou ventilation `document (8)`), attacher les paiements ensuite.** Les events dont le total
  n'est pas fiable → paiements en attente → résiduel.
- **Acompte** : re-dériver le montant d'acompte depuis le frais quand il a bougé (pas seulement à l'import initial).
- **Avoirs** : choisir UNE représentation (avoir BS netté dans le total vs paiement négatif ME) et une règle
  pour les events qui ont les deux. `completed` doit être cohérent avec la somme des lignes de paiement.
- **Filtre "facturé"** des 133 écarts / 43 factures-sans-devis : non documenté → **le reconstruire et l'écrire**
  avant de recaler du € prod (sinon population différente de celle revue).

### G4 — Tous les events BS à jour
- 134 nouveaux events à créer (statut, resto via `VENUE_TO_RESTAURANT`, date, total) + contacts (dédup sur
  email sinon nom+`account`, pour ne pas accumuler des doublons entre vagues).
- **Prérequis dur** : ré-export sans cap → ~70 events futurs absents. 2 "disparus" dans la fenêtre → vérif manuelle.
- **Merges "Fusionner"** (2 events ME → 1 BS) : à analyser avant création (risque doublon/orphelin).
- **Champs opérationnels** (date/pax faits via l'arbitre ; menu/allergies/déroulé/espace/horaires non encore
  comparés) → à ajouter à l'arbitre comme champs **non tracés** (BS≠ME → résiduel, jamais auto-écraser ME).

### G5 — Fichier minimal d'incohérences
- **Fait pour statut/date/pax** : `backups/arbiter_residual.csv` (43 lignes).
- **À consolider** : y verser AUSSI les résiduels montant/acompte (G3), les devis multi-version ambigus (G2),
  les events rejetés par le gate 2%, les merges (G4), et les divergences sur champs non tracés. Un seul fichier,
  avec old/new des deux côtés + dernier éditeur/date côté ME.
- **Limite connue** : sans le `updatedAt` Firestore BS, les lignes "les deux ont édité" ne peuvent pas être
  ordonnées dans le temps → les marquer "ordre inconnu" plutôt que de deviner.

## Chantiers restants (résumé)
- **Moteur devis-PDF** (G2, ~1502 devis) — le plus gros morceau.
- **Repoint CSV frais + recompute des listes** (prérequis de tout apply).
- **G3** : reconstruire+documenter le filtre "facturé" ; re-dériver les acomptes ; règle avoirs.
- **Restore scripts** par writer + RPC/mono-thread pour la transactionnalité.
- **Ré-export events non cappé** (USER) ; analyse des merges ; champs opérationnels dans l'arbitre.
- **Refactor arrondi** (Phase 5) en dernier.

## Données & artefacts (chemins)
- Events frais : `~/Downloads/document (7).csv` ; facturation fraîche : `~/Downloads/document (8).csv`.
- Récolte devis web : `~/Downloads/bs_devis_links_full.json` (4019 devis).
- DB : service-role REST via `scripts/booking_shake_import/lib.py` `Supa` (`backend/.env`).
  `ORG_ID = 425be1b8-f059-4a4f-8e94-d8b8fe69ab27`, `SOURCE = booking_shake`.
- Scripts : `arbiter_activity_logs.py` (arbitre), `reprice_unitprice_ht.py` (fix double-TVA), `phase6/8/9`
  (enrichissement facture, durcis), `lib.py` (`unit_price_ht`, `STATUS_TO_ID`, `VENUE_TO_RESTAURANT`).
- Sorties arbitre : `backups/arbiter_residual.csv` (G5) + `backups/arbiter_auto_{status,date,pax}.csv` (G1).
