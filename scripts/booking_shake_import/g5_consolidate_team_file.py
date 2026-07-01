"""G5 -- consolide tous les residuels (cas a trancher par les equipes BS) en UN seul CSV minimal.

Principe : un event ne va aux equipes que s'il y a une VRAIE decision qui change une donnee
(statut, total, acompte, cash). On EXCLUT :
  - les caducs (event Annule -- l'arbitre G1 gere) ;
  - les facturés dont le total ME colle deja au facturé BS (rien a trancher : seul le detail-ligne
    manque, non bloquant).
Lit les CSV residuels de chaque phase, mappe sur un schema commun, ecrit backups/equipes_a_trancher.csv.
Lecture DB (statut/facturation, pour le filtre). Usage : python3 g5_consolidate_team_file.py"""
import csv
from collections import Counter
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, EVENTS_CSV, BILLING_CSV, load_csv, s, dec

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
OUT = BACKUP_DIR / "equipes_a_trancher.csv"
COLS = ["objectif", "type", "event_id", "champ", "valeur_bs", "valeur_me",
        "statut_me", "montant_me", "quote_number", "editeur_me", "date_edition_me", "action_attendue"]
AX_LABEL = {"statut": "statut", "date": "date", "pax": "couverts"}
db = Supa(*load_env()[:2])


def read(name):
    p = BACKUP_DIR / name
    return list(csv.DictReader(open(p, encoding="utf-8"))) if p.exists() else []


def blank():
    return {c: "" for c in COLS}


# --- filtres (DB + CSV frais) ---
ev = {}
for r in load_csv(EVENTS_CSV):
    e = s(r.get("event_id"))
    if e:
        ev[e] = (dec(r.get("amount_paid")) or 0) + (dec(r.get("amount_waiting")) or 0)
has_bill = set()
for r in load_csv(BILLING_CSV):
    e = s(r.get("event_id")); t = (r.get("type") or "").strip()
    if e and t in ("facture", "acompte", "solde") and (r.get("invoice_status") or "") != "Annulé" and (dec(r.get("amountTTC")) or 0) > 0:
        has_bill.add(e)
bk = db.get_all("bookings", "external_id,status_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
stn = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}
annule = {b["external_id"] for b in bk if b.get("external_id") and "Annul" in (stn.get(b["status_id"], "") or "")}
quotes = db.get_all("quotes", "external_id,total_ttc", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
tot_me = {q["external_id"]: (q.get("total_ttc") or 0) for q in quotes if q.get("external_id")}


def caduc(e):
    return e in annule


def settled(e):
    """Facturé dont le total ME colle deja au facturé BS -> rien a trancher (seul le detail manque)."""
    b = ev.get(e, 0)
    return e in has_bill and b > 0 and abs(tot_me.get(e, 0) - b) <= max(10, 0.02 * b)


rows = []

# G1 -- statut/date/couverts : ME edite apres import, BS differe (vraie question, on garde tout).
for r in read("arbiter_residual.csv"):
    e = r["event_id"]
    if caduc(e):
        continue
    o = blank()
    o.update(objectif="G1 statut/planning", type=AX_LABEL.get(r["axe"], r["axe"]), event_id=e,
             champ=AX_LABEL.get(r["axe"], r["axe"]), valeur_bs=r["valeur_BS"], valeur_me=r["valeur_ME"],
             editeur_me=r["dernier_editeur_ME"], date_edition_me=r["date_edition_ME"],
             action_attendue="ME modifie a la main apres l'import, BS differe -- confirmer la valeur qui fait foi")
    rows.append(o)

# G2 -- devis a versions divergentes : garde seulement si non caduc ET total pas deja regle.
for r in read("g2_residual_devis.csv"):
    e = r["event_id"]
    if caduc(e) or settled(e):
        continue
    raison = r["raison"]
    if raison.startswith("versions_divergentes"):
        rng = raison.split("(", 1)[1].rstrip(")") if "(" in raison else ""
        typ, vbs = "version devis", f"versions {rng.replace('-', ' a ')} EUR" if rng else "versions divergentes"
        act = "Plusieurs versions de devis, totaux divergents, aucune validee -- indiquer la version qui fait foi"
    elif raison.startswith("lignes"):
        typ, vbs, act = "lignes incoherentes", raison, "Les lignes ne reconcilient pas le total -- verifier le detail"
    else:
        typ, vbs, act = "devis illisible", raison, "PDF illisible automatiquement -- fournir le detail des lignes"
    o = blank()
    o.update(objectif="G2 devis", type=typ, event_id=e, champ="total devis", valeur_bs=vbs,
             valeur_me=r["total_ME"], statut_me=r["statut_ME"], montant_me=r["total_ME"], action_attendue=act)
    rows.append(o)

# G2 -- devis introuvables : garde seulement si non caduc ET total pas deja regle.
for r in read("g2_a_recuperer.csv"):
    e = r["event_id"]
    if caduc(e) or settled(e):
        continue
    act = ("Aucun lien BS (bookingId manquant) -- fournir le devis source" if r["raison"] == "no_bookingId"
           else "Devis non recupere depuis BS -- fournir le PDF / detail du devis")
    o = blank()
    o.update(objectif="G2 devis", type="devis introuvable", event_id=e, valeur_me=r["total_ME"],
             statut_me=r["statut"], montant_me=r["total_ME"], quote_number=r["quote_number"], action_attendue=act)
    rows.append(o)

# G3 -- total devis ambigu (les avoirs de ce fichier sont remplaces par g3_avoir_residual).
for r in read("g3_residual_totaux.csv"):
    if r["categorie"] == "avoir" or caduc(r["event_id"]):
        continue
    o = blank()
    o.update(objectif="G3 facturation", type="total devis ambigu", event_id=r["event_id"], champ="total",
             valeur_me=r["total_ME"], montant_me=r["total_ME"],
             action_attendue="Total non determinable auto (" + r["detail"] + ") -- indiquer le devis qui fait foi")
    rows.append(o)

# G3 -- avoirs VIFS (cash ou total ME ne colle pas au net BS apres avoir).
for r in read("g3_avoir_residual.csv"):
    e = r["event_id"]
    if caduc(e):
        continue
    o = blank()
    o.update(objectif="G3 facturation", type="avoir", event_id=e, champ="net facture", valeur_bs=r["encaisse_BS"],
             valeur_me=r["cash_ME"], statut_me=r["statut_ME"], montant_me=r["total_ME"],
             action_attendue=f"Avoir {r['avoir']} EUR -- {r['raison']} -- confirmer le net du et l'encaisse")
    rows.append(o)

# G3 -- acompte multi-doc ambigu (2+ acomptes actifs, aucun ne tranche).
for r in read("g3_acompte_residual.csv"):
    e = r["event_id"]
    if caduc(e):
        continue
    o = blank()
    o.update(objectif="G3 facturation", type="acompte ambigu", event_id=e, champ="acompte", valeur_bs=r["acomptes_actifs"],
             valeur_me=r["acompte_attendu"], statut_me=r["statut_ME"], montant_me=r["total_ME"],
             action_attendue="Plusieurs acomptes actifs, aucun ne correspond a l'attendu -- indiquer l'acompte du")
    rows.append(o)

rows.sort(key=lambda r: (r["objectif"], r["type"], r["event_id"]))
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=COLS)
    w.writeheader(); w.writerows(rows)

print(f"=== G5 -- fichier equipes consolide : {OUT.name} ===")
print(f"  total cas a trancher : {len(rows)}  (etait 368)")
for k, v in Counter((r["objectif"], r["type"]) for r in rows).most_common():
    print(f"    {v:4}  {k[0]:18} {k[1]}")
