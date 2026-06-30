# État d'avancement — Réconciliation Booking Shake ⟷ MealEvent

Trace vivante de ce qui est **fait** et de ce qui **reste**. Mis à jour le **2026-07-01**.
Plan détaillé (le "comment") : [booking-shake-action-plan.md](booking-shake-action-plan.md). Journal : [booking-shake-reconciliation.md](booking-shake-reconciliation.md).

## Où on en est (résumé)

On rattrape un mois de divergence BS → ME (merge 2 sens, ME-natifs protégés). Le bug double-TVA est corrigé, l'enrichissement des devis **forecast** est fait, l'arbitre de source de vérité est construit. Restent : le facture-path, l'application des statuts/paiements, les nouveaux events, et la consolidation du fichier équipes.

## Chiffres clés (au 01/07)

| | |
|---|---|
| Devis BS | 3174 (placeholders **1369** · enrichis **1793** · vides 12) |
| CA BS (somme total_ttc) | **17 145 503 €** |
| ME-natifs (intouchables) | 1694 bookings · 681 devis · 163 paiements |
| Bookings BS | 14 165 |

## Fait ✅

- **[16-29/06] 5 vagues d'import** (prod) : phase5 (headers), phase6 (lignes 3179→5550), phase7 (relink, orphelins 342→1), phase8/9 (28 devis). Snapshots dans `backups/`.
- **[30/06] Fix double-TVA** : `unit_price` était stocké en TTC alors que l'app le traite en HT → +1,31M à la ré-édition. Reprice `unit_price = total_ht/quantité` sur **7097 lignes / 1325 devis** (`reprice_unitprice_ht.py`). Inflation → +3,1k. Headers/ME-natifs intacts. Snapshot `reprice_snapshot_20260630_233949.json`.
- **[01/07] Idempotence enrichissement** : `phase6/8/9` font DELETE (scopé devis) **avant** insert et stockent le HT via `lib.unit_price_ht()`. Plus de lignes orphelines.
- **[01/07] Arbitre `activity_logs`** (`arbiter_activity_logs.py`, lecture seule) : par event/champ, BS-auto si ME pas touché depuis l'import (04/06), sinon résiduel. Résultats : **statut 480 auto / 35 résiduel · date 19/1 · couverts 63/7**. Fichiers : `backups/arbiter_auto_{status,date,pax}.csv` + `arbiter_residual.csv` (43).
- **[01/07] G2 forecast** (`enrich_devis_pdf.py`, appliqué) : **468 devis forecast enrichis** (1897 vraies lignes), total calé sur le vrai devis (version Validé d'abord, sinon dernière si versions ≤5%). Placeholders 1837→1369, CA −26k. Vérifié : 0 unit_price≠HT, 0 orphelin, ME-natifs intacts. Snapshots `enrich_devis_snapshot_20260701_*.json`.

## Reste à faire ⏳

### G2 — détails devis/placeholder (forecast fait, reste le facturé)
- [ ] **Facture-path sur les 687 facturés** : corriger le dédup au niveau **document** (collapse des factures répétées = tueur de couverture) + repointer `lib.BILLING_CSV` sur `document (8)` → dry-run + apply (`phase8/9`). Couverture attendue limitée (~47-164 réconcilient).
- [ ] **112 versions ambiguës** (`backups/g2_residual_devis.csv`) → équipes BS (quelle version fait foi).
- [ ] **175 à récupérer** (`backups/g2_a_recuperer.csv`) + 35 sans devis/event → vérif manuelle dans BS.
- [ ] 535 annulés : caducs (traités par G1).

### G1 — statuts
- [ ] Appliquer l'arbitre : **480 statuts BS-auto** (+ date 19, couverts 63). Garde annulation (0 paiement ME) à re-vérifier à l'apply.
- [ ] Recompute des listes juste avant l'apply (les équipes éditent en continu).
- [ ] Étendre l'arbitre aux champs **non tracés** (menu/allergies/horaires) → BS≠ME = résiduel, jamais auto-écraser ME.

### G3 — facturation
- [ ] Reconstruire et **documenter le filtre "facturé"** (133 écarts / 43 factures-sans-devis non reproductibles à l'aveugle).
- [ ] **Corriger les totaux AVANT d'attacher les paiements** (reste-à-payer = total − paiements). Re-dériver les acomptes depuis `document (8)`.
- [ ] Importer les **159 lignes de paiement** (additif, clé `event:facture:type:pN`). Règle avoirs (BS netté vs paiement négatif ME).
- [ ] Étendre l'arbitre à l'axe montant/acompte.

### G4 — tous les events à jour
- [ ] **[USER] Ré-exporter les events sans cap de date** (~70 futurs absents) — prérequis dur.
- [ ] Créer les **134 nouveaux events** + contacts (dédup email/nom+account).
- [ ] Analyser les merges "Fusionner" (2 ME → 1 BS). Vérifier les 2 disparus dans la fenêtre.
- [ ] Champs opérationnels (menu/allergies/déroulé/espace/horaires) dans l'arbitre.

### G5 — fichier minimal pour les équipes
- [ ] **Consolider en UN fichier** : `arbiter_residual.csv` (43) + `g2_residual_devis.csv` (112) + montant/acompte (G3) + merges (G4) + champs non tracés. Avec old/new des deux côtés + dernier éditeur ME.

### Transverse (prod)
- [ ] **Repointer `lib.BILLING_CSV`/`EVENTS_CSV`** sur `document (8)/(7)` avant tout apply facturation.
- [ ] **Script de restore testé** par writer (seul phase5 en a un).
- [ ] **Transactionnalité** par devis (RPC Postgres ou mono-thread + vérif lignes>0).
- [ ] **Refactor arrondi** (ceil par ligne) = EN DERNIER, après data propre. ~78 devis à petit écart header/lignes (ex `23KZM4EMSY` −147) y sont rattachés.

## Artefacts

- **Scripts** (`scripts/booking_shake_import/`) : `reprice_unitprice_ht.py`, `arbiter_activity_logs.py`, `enrich_devis_pdf.py`, `phase6/8/9_*` (facture-path), `lib.py` (`unit_price_ht`, `STATUS_TO_ID`, `VENUE_TO_RESTAURANT`).
- **Snapshots rollback** : `backups/*_snapshot_*.json`.
- **Fichiers équipes** : `backups/arbiter_residual.csv` (43), `g2_residual_devis.csv` (112), `g2_a_recuperer.csv` (175).
- **Sources** : `~/Downloads/document (7).csv` (events), `document (8).csv` (facturation), `bs_devis_links_full.json` (4019 devis). DB via `lib.Supa` (service-role, `backend/.env`).

> Note : scripts et docs sont dans l'arbre de travail, **non commités**.
