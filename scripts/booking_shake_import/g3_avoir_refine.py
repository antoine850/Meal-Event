"""G3/avoirs -- affine "tous les avoirs -> equipes" pour ne garder QUE les vraies incoherences.

Un avoir (note de credit) ne devient une question equipes que s'il laisse la facturation ME
incoherente. On DROPPE les avoirs deja reconcilies :
  - event Annule (l'arbitre G1 gere) ;
  - 0 encaisse cote event (aucun impact cash) ;
  - cash ME = encaisse BS (ap doc7) ET total ME = ap+aw (BS net post-avoir) a ~2% -> deja coherent.
On GARDE (=> equipes) les avoirs "vifs" ou le cash ou le total ME ne colle pas au net BS.
Lecture seule. Ecrit backups/g3_avoir_residual.csv."""
import sys, csv as csvmod
from collections import defaultdict, Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, EVENTS_CSV, BILLING_CSV, load_csv, s, dec, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
db = Supa(*load_env()[:2])


def cl(a, b, p=0.02):
    return abs(a - b) <= max(10, p * max(abs(a), abs(b)))


ev = {}
for r in load_csv(EVENTS_CSV):
    e = s(r.get("event_id"))
    if e:
        ev[e] = {"ap": dec(r.get("amount_paid")) or 0, "aw": dec(r.get("amount_waiting")) or 0}

avoir_amt = defaultdict(float)
has_bill = set()
for r in load_csv(BILLING_CSV):
    e = s(r.get("event_id")); t = (r.get("type") or "").strip()
    if not e:
        continue
    if "avoir" in t:
        avoir_amt[e] += dec(r.get("amountTTC")) or 0
        continue
    if (r.get("invoice_status") or "") == "Annulé":
        continue
    if t in ("facture", "acompte", "solde") and (dec(r.get("amountTTC")) or 0) > 0:
        has_bill.add(e)

quotes = db.get_all("quotes", "id,external_id,total_ttc,status", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
q_by_e = {q["external_id"]: q for q in quotes if q.get("external_id")}
bk = db.get_all("bookings", "id,external_id,status_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
stn = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}
bid_by_e = {b["external_id"]: b["id"] for b in bk if b.get("external_id")}
st_by_e = {b["external_id"]: stn.get(b["status_id"], "?") for b in bk if b.get("external_id")}
pay = db.get_all("payments", "booking_id,amount,status", f"organization_id=eq.{ORG_ID}")
paid_by_bid = defaultdict(float)
for p in pay:
    if p.get("booking_id") and (p.get("amount") or 0):
        paid_by_bid[p["booking_id"]] += float(p["amount"])

avoir_events = [e for e in avoir_amt if e in has_bill]
seg = Counter()
keep = []
for e in avoir_events:
    st = st_by_e.get(e, "")
    ap, aw = ev.get(e, {}).get("ap", 0), ev.get(e, {}).get("aw", 0)
    q = q_by_e.get(e)
    me_total = (q.get("total_ttc") or 0) if q else 0
    me_paid = paid_by_bid.get(bid_by_e.get(e), 0)
    if "Annul" in (st or ""):
        seg["annule (G1)"] += 1; continue
    if ap == 0:
        seg["0 encaisse"] += 1; continue
    cash_ok = cl(me_paid, ap)
    total_ok = cl(me_total, ap + aw)
    if cash_ok and total_ok:
        seg["deja coherent (cash+total)"] += 1; continue
    reason = []
    if not cash_ok:
        reason.append(f"cash ME {me_paid:.0f}!=BS {ap:.0f}")
    if not total_ok:
        reason.append(f"total ME {me_total:.0f}!=net BS {ap+aw:.0f}")
    seg["VIF -> equipes"] += 1
    keep.append({"event_id": e, "statut_ME": st, "total_ME": round(me_total, 2),
                 "avoir": round(avoir_amt[e], 2), "encaisse_BS": round(ap, 2), "cash_ME": round(me_paid, 2),
                 "raison": " ; ".join(reason)})

section("G3 AVOIRS -- affinage (vraies incoherences seulement)")
line("events avec avoir + facturation active", len(avoir_events))
for k in ["annule (G1)", "0 encaisse", "deja coherent (cash+total)", "VIF -> equipes"]:
    line(f"  {k}", seg.get(k, 0))

BACKUP_DIR.mkdir(exist_ok=True)
with open(BACKUP_DIR / "g3_avoir_residual.csv", "w", newline="", encoding="utf-8") as f:
    w = csvmod.DictWriter(f, fieldnames=["event_id", "statut_ME", "total_ME", "avoir", "encaisse_BS", "cash_ME", "raison"])
    w.writeheader(); w.writerows(sorted(keep, key=lambda r: -r["avoir"]))
line(">> avoirs vifs (G5)", f"backups/g3_avoir_residual.csv ({len(keep)})")
print("\n  echantillon (event : avoir | encaisse BS | cash ME | total ME | raison)")
for r in sorted(keep, key=lambda r: -r["avoir"])[:12]:
    print(f"     {r['event_id']:12} avoir={r['avoir']:>8.0f}  encBS={r['encaisse_BS']:>8.0f}  cashME={r['cash_ME']:>8.0f}  totME={r['total_ME']:>8.0f}  {r['raison']}")
