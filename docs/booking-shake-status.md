# État d'avancement — Réconciliation Booking Shake ⟷ MealEvent

Trace vivante de ce qui est **fait** et de ce qui **reste**. Mis à jour le **2026-07-01**.
Plan détaillé (le "comment") : [booking-shake-action-plan.md](booking-shake-action-plan.md). Journal : [booking-shake-reconciliation.md](booking-shake-reconciliation.md).

## Où on en est (résumé)

On rattrape un mois de divergence BS → ME (merge 2 sens, ME-natifs protégés). Le bug double-TVA est corrigé, l'enrichissement des devis **forecast** est fait, l'arbitre de source de vérité est construit. Restent : le facture-path, l'application des statuts/paiements, les nouveaux events, et la consolidation du fichier équipes.

## Chiffres clés (au 01/07)

|                          |                                                             |
| ------------------------ | ----------------------------------------------------------- |
| Devis BS                 | 3174 (placeholders **1369** · enrichis **1793** · vides 12) |
| CA BS (somme total_ttc)  | **17 145 503 €**                                            |
| ME-natifs (intouchables) | 1694 bookings · 681 devis · 163 paiements                   |
| Bookings BS              | 14 165                                                      |

## Fait ✅

- **[16-29/06] 5 vagues d'import** (prod) : phase5 (headers), phase6 (lignes 3179→5550), phase7 (relink, orphelins 342→1), phase8/9 (28 devis). Snapshots dans `backups/`.
- **[30/06] Fix double-TVA** : `unit_price` était stocké en TTC alors que l'app le traite en HT → +1,31M à la ré-édition. Reprice `unit_price = total_ht/quantité` sur **7097 lignes / 1325 devis** (`reprice_unitprice_ht.py`). Inflation → +3,1k. Headers/ME-natifs intacts. Snapshot `reprice_snapshot_20260630_233949.json`.
- **[01/07] Idempotence enrichissement** : `phase6/8/9` font DELETE (scopé devis) **avant** insert et stockent le HT via `lib.unit_price_ht()`. Plus de lignes orphelines.
- **[01/07] Arbitre `activity_logs`** (`arbiter_activity_logs.py`, lecture seule) : par event/champ, BS-auto si ME pas touché depuis l'import (04/06), sinon résiduel. Résultats : **statut 480 auto / 35 résiduel · date 19/1 · couverts 63/7**. Fichiers : `backups/arbiter_auto_{status,date,pax}.csv` + `arbiter_residual.csv` (43).
- **[01/07] G2 forecast** (`enrich_devis_pdf.py`, appliqué) : **468 devis forecast enrichis** (1897 vraies lignes), total calé sur le vrai devis (version Validé d'abord, sinon dernière si versions ≤5%). Placeholders 1837→1369, CA −26k. Vérifié : 0 unit*price≠HT, 0 orphelin, ME-natifs intacts. Snapshots `enrich_devis_snapshot_20260701*\*.json`.
- **[01/07] Commit** `ba1b4e4` (branche `feat/booking-shake-reconciliation`, 21 fichiers : scripts + 3 docs). `lib` repointé sur `document (8)/(7)` (frais), dédup `phase9` corrigé au niveau document. Constat facturés : couverture 12 (total stocké) / 79 (vrai montant facturé) / 213 inextricables → enrichissement des facturés reporté en G3 (couplé aux totaux + paiements).
- **[01/07] G1 statuts appliqué** (`g1_apply_arbiter.py --apply`) : **501 bookings patchés** — statut **480**, date **19**, couverts **63**. Re-dérivé depuis la source (doc7 + bookings + activity_logs), garde annulation OK (**254 → Annulé, 0 paiement encaissé, 0 event clôturé**). Résiduels non appliqués → G5 : statut **35**, date **1**, couverts **7**. Idempotent vérifié (re-run = 0 auto). Snapshot `backups/g1_snapshot_20260701_012704.json`.

## Reste à faire ⏳

### G2 — détails devis/placeholder

- [x] **Forecast : fait** (468 enrichis, voir ci-dessus).
- [x] Dédup `phase9` corrigé (niveau document) + `lib` repointé sur `document (8)/(7)`.
- [→ G3] **Facturés (292 avec doc live)** : la part propre (12 réconcilient au total stocké). Réconcilier au **vrai montant facturé** (doc7) monte à **79**, mais ça exige de corriger le total ET les paiements ensemble → **traité en G3**. Les **213** restants ne réconcilient pas (avoirs/soldes partiels) → résiduel ou ventilation TVA doc8.
- [ ] **112 versions ambiguës** (`backups/g2_residual_devis.csv`) → équipes BS (quelle version fait foi).
- [ ] **175 à récupérer** (`backups/g2_a_recuperer.csv`) + 35 sans devis/event → vérif manuelle dans BS.
- [ ] 535 annulés : caducs (traités par G1).

### G1 — statuts

- [x] **Arbitre appliqué** : 480 statuts + 19 dates + 63 couverts (501 bookings). Garde annulation vérifiée (254 → Annulé, 0 encaissé, 0 clôturé). Résiduels 35/1/7 → G5.
- [ ] Étendre l'arbitre aux champs **non tracés** (menu/allergies/horaires) → BS≠ME = résiduel, jamais auto-écraser ME.

### G3 — facturation

Décisions actées : avoirs → équipes (pas d'auto) · acompte demandé = montant exact BS via `deposit_amount_override`. Ordre strict **C (total) → D (acompte)**. Signal clé : **`invoice_status`=Annulé sur un doc = doc mort/remplacé** (l'actif est Payé/En cours) → départage beaucoup de multi-docs.

- [x] **A. Delta d'encaissements importé** (`g3a_import_payments.py --apply`) : **107 paiements** (235k€, 92 events) ajoutés, docs actifs seulement (Annulé/avoir exclus), dédup event+montant vs 3038 déjà en base, 9 orphelins (event sans booking → G4) écartés, 0€ filtrés. Réutilise la logique `phase3_billing` (clé + type deposit/balance) mais table `payments` seule. Rollback `backups/g3a_inserted_20260701_020201.json`. Idempotent (re-run = 0).
- [x] **C. Totaux facturés corrigés (cœur)** (`g3c_fix_totals.py --apply`) : **58 devis placeholder + facture complète** corrigés (header + ligne placeholder → `ap+aw`, garde « facture complète corroborée par les docs » = facture OU acompte+solde tous deux émis). Cas extrêmes vérifiés pièces en main (VYFGKWC2Q9 29k→58k = acompte seul avant ; H7ALIWOXU7 19k→6k = placeholder périmé). Idempotent, header==ligne sur les 58 (recalcul ne rebascule pas). Snapshot `backups/g3c_snapshot_20260701_022508.json`. **Modèle acté : `total_ttc` = devis complet, PAS le facturé-à-ce-jour** ; « facture complète » = acompte+solde tous deux émis (solde peut être En cours). Les **40 enrichis (lignes=devis) → LAISSÉS** (pas des erreurs, facturation partielle).
- [x] **C. Partiels récupérés** (`g3c_recover_partial.py --apply`) : sur 21 placeholder+acompte-seul, **11 récupérés** via le devis récolté (moteur G2 : map bookingId → version Validé/≤5% → parse PDF → lignes réconcilient) **+ garde acompte** (devis ≥ acompte, ratio sain ; la plupart acompte=80%). Vérifié pièces en main (KEE7MVD9OM : devis 7258 = somme des encaissements). header==lignes sur les 11. Snapshot `backups/g3c_recover_snapshot_20260701_023438.json`. **C total = 69 devis corrigés** (58 cœur + 11 récup).
- [ ] **C. Reste → équipes** : 10 (versions divergentes >5% / acompte introuvable) + 28 avoirs → écrire un CSV et l'ajouter à `g5_consolidate_team_file.py`.
- [x] **D. Acompte aligné** (`g3d_apply_acompte.py --apply`) : **30 overrides posés** (acompte unique actif, sans override → `deposit_amount_override` = acompte BS exact). Audit `g3_acompte_audit.py` : 1535 déjà OK, 0 à corriger après apply, 22 ambigus (2+ acomptes actifs) + 174 avoir + 6 bruit → équipes. **0 override réécrit.** Règles gravées : acompte BS = plus GROS doc acompte actif ; Annulé = mort ; multi-acompte actif = ambigu, on ne touche pas ; jamais réécrire un override. Snapshot `backups/g3d_snapshot_20260701_020202.json`.
- [ ] Router les résiduels acompte (22 ambigu + 6 bruit + les avoir) vers `equipes_a_trancher.csv`.

### G4 — tous les events à jour

- [ ] **[USER] Ré-exporter les events sans cap de date** (~70 futurs absents) — prérequis dur.
- [ ] Créer les **134 nouveaux events** + contacts (dédup email/nom+account).
- [ ] Analyser les merges "Fusionner" (2 ME → 1 BS). Vérifier les 2 disparus dans la fenêtre.
- [ ] Champs opérationnels (menu/allergies/déroulé/espace/horaires) dans l'arbitre.

### G5 — fichier minimal pour les équipes

- [x] **UN fichier consolidé** : `g5_consolidate_team_file.py` → `backups/equipes_a_trancher.csv` (**330 cas** : G1 statut/date/couverts 43 + G2 versions divergentes 108 + devis introuvables 175 + illisibles/incohérents 4). Schéma commun (objectif · type · BS · ME · éditeur ME · action_attendue).
- [ ] Re-run du script quand G3 (montant/acompte) et G4 (merges, champs non tracés) auront déposé leurs résiduels → ils s'ajoutent au même fichier.

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
