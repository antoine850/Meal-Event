"""G3/D -- audit de l'acompte DEMANDE (deposit) sur les devis BS actifs. LECTURE SEULE.

Question : combien des overrides ME collent deja au vrai acompte BS, combien restent a corriger ?
Definitions :
  acompte BS  = doc 'acompte' non-avoir le plus recent (par creationDate), amountTTC.
  total BS    = doc 'facture' non-avoir le plus recent ; sinon acompte + solde.
  affiche ME  = deposit_amount_override si pose, sinon deposit_percentage% * total_ttc stocke.
Buckets (priorite) : avoir->equipes | bruit->equipes | deja_ok | a_corriger (dont paye_100pct).
Ecrit backups/g3_acompte_audit.csv (detail par event). Usage : python3 ... g3_acompte_audit.py"""
import sys, csv
from collections import defaultdict, Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, BILLING_CSV, load_csv, s, dec

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
db = Supa(*load_env()[:2])


def tol(a):
    return max(2.0, 0.01 * abs(a))


def pdate(v):
    p = (v or "").strip().split("-")  # creationDate = DD-MM-YYYY
    if len(p) == 3 and all(x.isdigit() for x in p):
        return (int(p[2]), int(p[1]), int(p[0]))
    return (0, 0, 0)


# ME : devis BS + statut event
quotes = db.get_all("quotes", "id,external_id,total_ttc,deposit_percentage,deposit_amount_override",
                    f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
bk = db.get_all("bookings", "external_id,status_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
stn = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}
ev_status = {b["external_id"]: stn.get(b["status_id"], "?") for b in bk if b.get("external_id")}

# BS docs par event/type (non-avoir), garde le plus recent par creationDate
bi = load_csv(BILLING_CSV)
docs = defaultdict(lambda: defaultdict(list))  # eid -> type -> [(date_tuple, index, amountTTC)]
avoir_evt = set()
for r in bi:
    t = (r.get("type") or "").strip()
    eid = s(r.get("event_id"))
    if not eid:
        continue
    if "avoir" in t:
        avoir_evt.add(eid)
        continue
    if (r.get("invoice_status") or "").strip() == "Annulé":
        continue  # doc remplace/mort -> pas un candidat ; l'actif est Paye/En cours
    am = dec(r.get("amountTTC"))
    if am is not None:
        try:
            idx = int(r.get("index"))
        except (TypeError, ValueError):
            idx = 0
        docs[eid][t].append((pdate(r.get("creationDate")), idx, am))


def biggest(eid, typ):
    """Plus gros doc du type (montant). L'acompte principal est le plus gros ; les autres docs
    acompte sont des compléments/avenants, pas le 'demandé'. Idem solde (le solde principal)."""
    lst = docs.get(eid, {}).get(typ) or []
    return max((a for _, _, a in lst), default=0.0)


def bs_total(eid):
    f = biggest(eid, "facture")
    if f:
        return f
    a, so = biggest(eid, "acompte"), biggest(eid, "solde")
    return a + so if (a or so) else 0.0


rows = []
bucket = Counter()
fix_reason = Counter()
multi_acompte = 0

for q in quotes:
    eid = q["external_id"]
    status = ev_status.get(eid, "?")
    if "Annul" in status:
        continue
    a_docs = docs.get(eid, {}).get("acompte") or []
    if len(a_docs) > 1:
        multi_acompte += 1
    bs_acc = biggest(eid, "acompte")
    if not bs_acc:
        continue  # pas de doc acompte BS -> rien a aligner ici
    bt = bs_total(eid)
    me_tot = q.get("total_ttc") or 0
    ovr = q.get("deposit_amount_override")
    pct = q.get("deposit_percentage") or 0
    me_disp = ovr if ovr is not None else round(me_tot * pct / 100, 2)

    n_acc = len(a_docs)
    if me_disp is not None and abs(me_disp - bs_acc) <= tol(bs_acc):
        b = "deja_ok"  # acompte affiche colle deja -> rien a faire, meme si avoir
    elif bs_acc <= 0 or bt <= 0 or bs_acc > bt * 1.05:
        b = "bruit_equipes"
    elif eid in avoir_evt:
        b = "avoir_equipes"  # a corriger MAIS avoir present -> equipes (decision user)
    elif n_acc > 1:
        b = "ambigu_multi_acompte"  # plusieurs docs acompte -> 'demande' indefini, on ne touche pas
    else:
        b = "a_corriger"  # acompte unique -> depot non ambigu, override = ce montant
        if ovr is not None:
            fix_reason["override_present_faux"] += 1
        elif bt and bs_acc >= 0.97 * bt:
            fix_reason["paye_100pct"] += 1
        elif abs(round(me_tot * 0.8, 2) - bs_acc) > tol(bs_acc) and abs(me_tot - bt) > tol(bt):
            fix_reason["total_ME_perime"] += 1
        else:
            fix_reason["taux_BS_!=80pct"] += 1
    bucket[b] += 1
    rows.append({"event_id": eid, "statut": status, "bucket": b, "n_acompte": n_acc,
                 "bs_acompte": round(bs_acc, 2), "bs_total": round(bt, 2),
                 "me_total": round(me_tot, 2), "me_override": ovr,
                 "me_pct": pct, "me_affiche": round(me_disp, 2) if me_disp is not None else None,
                 "ratio_bs": round(bs_acc / bt, 3) if bt else None,
                 "delta": round((me_disp or 0) - bs_acc, 2)})

BACKUP_DIR.mkdir(exist_ok=True)
with open(BACKUP_DIR / "g3_acompte_audit.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(sorted(rows, key=lambda r: (r["bucket"], r["event_id"])))

# decompose 'deja_ok' et 'a_corriger' par presence d'override
ok_ovr = sum(1 for r in rows if r["bucket"] == "deja_ok" and r["me_override"] is not None)
ok_noovr = sum(1 for r in rows if r["bucket"] == "deja_ok" and r["me_override"] is None)
fix_ovr = sum(1 for r in rows if r["bucket"] == "a_corriger" and r["me_override"] is not None)
fix_noovr = sum(1 for r in rows if r["bucket"] == "a_corriger" and r["me_override"] is None)

print("=== G3/D AUDIT ACOMPTE (devis BS actifs avec doc acompte BS) ===")
print(f"  univers analyse : {len(rows)}   (events multi-doc acompte : {multi_acompte})")
print()
for b, n in bucket.most_common():
    print(f"  {n:5}  {b}")
print()
print(f"  DEJA OK   : override colle {ok_ovr} · 80%xtotal colle {ok_noovr}")
print(f"  A CORRIGER: override faux {fix_ovr} · sans override {fix_noovr}")
print(f"  detail a_corriger : {dict(fix_reason)}")
print(f"\n  >> detail par event : backups/g3_acompte_audit.csv")
