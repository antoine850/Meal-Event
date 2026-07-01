"""G1 -- applique l'arbitre des statuts/date/couverts aux bookings BS-sourced.

Re-derive l'arbitrage depuis la SOURCE (document (7).csv + bookings ME + activity_logs), pas
depuis les CSV figes : on veut le vrai status_id et un etat ME frais au moment de l'apply.
Regle (cf arbiter_activity_logs.py) : champ edite par un user ME apres l'import (04/06) -> RESIDUEL ;
sinon BS-AUTO. Garde annulation : un passage en 'Annule' sur un event qui a un paiement ME 'paid'
est BLOQUE -> residuel (on n'annule jamais un event encaisse a l'aveugle).

total_ttc/quotes intacts : ce script ne touche QUE bookings.status_id/event_date/guests_count.
Snapshot avant ecriture. Dry-run par defaut ; --apply pour ecrire."""
import sys, json
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, STATUS_TO_ID, EVENTS_CSV, load_csv, date_iso, s, section, line

IMPORT_BOUNDARY = "2026-06-04T21:00:00"
ANNULE_ID = STATUS_TO_ID["Annulé"]
BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])


def pax_int(v):
    try:
        return int(float(str(v).replace(",", ".")))
    except (ValueError, TypeError):
        return None


# 1. source BS (frais)
bs = {}
for r in load_csv(EVENTS_CSV):
    eid = s(r.get("event_id"))
    if eid:
        bs[eid] = {"status": s(r.get("status")),
                   "date": date_iso(r.get("date_event")) or s(r.get("date_event")),
                   "pax": s(r.get("pax"))}

# 2. bookings ME BS-sourced
bk = db.get_all("bookings", "id,external_id,status_id,event_date,guests_count",
                f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
me = {b["external_id"]: b for b in bk if b.get("external_id")}
st = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}

# 3. editions user post-import par axe
logs = db.get_all("activity_logs", "booking_id,action_type,actor_name,metadata,created_at",
                  f"organization_id=eq.{ORG_ID}&actor_type=eq.user")
edited = defaultdict(dict)
for l in logs:
    if l["created_at"] <= IMPORT_BOUNDARY:
        continue
    bid, at, md = l["booking_id"], l["action_type"], (l.get("metadata") or {})
    if at == "booking.status_changed":
        edited[bid]["status"] = (l.get("actor_name") or "?", l["created_at"][:10])
    elif at == "booking.updated":
        ch = md.get("changes") or {}
        if "Date" in ch:
            edited[bid]["date"] = (l.get("actor_name") or "?", l["created_at"][:10])
        if "Convives" in ch:
            edited[bid]["pax"] = (l.get("actor_name") or "?", l["created_at"][:10])

# 4. garde annulation : bookings avec un paiement ME 'paid'
pays = db.get_all("payments", "booking_id,status", f"organization_id=eq.{ORG_ID}&status=eq.paid")
paid_bids = {p["booking_id"] for p in pays if p.get("booking_id")}

# 5. arbitrage -> patches
updates = defaultdict(dict)  # booking_id -> {col: value}
n_auto = Counter()
residual_n = Counter()
blocked = []  # (eid, statut_ME, statut_BS) annulations bloquees
unknown_status = 0

for eid, b in bs.items():
    m = me.get(eid)
    if not m:
        continue
    bid = m["id"]
    ax = edited.get(bid, {})

    bs_sid = STATUS_TO_ID.get(b["status"]) if b["status"] else None
    if b["status"] and bs_sid is None:
        unknown_status += 1
    elif bs_sid and bs_sid != m["status_id"]:
        if "status" in ax:
            residual_n["status"] += 1
        elif bs_sid == ANNULE_ID and bid in paid_bids:
            blocked.append((eid, st.get(m["status_id"], m["status_id"]), st.get(bs_sid, b["status"])))
            residual_n["status"] += 1
        else:
            updates[bid]["status_id"] = bs_sid
            n_auto["status"] += 1

    if b["date"] and m["event_date"] and b["date"] != m["event_date"]:
        if "date" in ax:
            residual_n["date"] += 1
        else:
            updates[bid]["event_date"] = b["date"]
            n_auto["date"] += 1

    bp, mp = pax_int(b["pax"]), pax_int(m["guests_count"])
    if bp is not None and mp is not None and bp != mp:
        if "pax" in ax:
            residual_n["pax"] += 1
        else:
            updates[bid]["guests_count"] = bp
            n_auto["pax"] += 1

section(f"G1 APPLY ARBITRE  [{'APPLY' if apply else 'DRY-RUN'}]  boundary={IMPORT_BOUNDARY[:10]}")
line("events BS compares (BS frais ET ME)", sum(1 for e in bs if e in me))
line("statuts BS non mappes (ignores)", unknown_status)
print()
line("STATUT  -> auto / residuel", f"{n_auto['status']} / {residual_n['status']}")
line("  dont annulation BLOQUEE (paiement ME)", len(blocked))
line("DATE    -> auto / residuel", f"{n_auto['date']} / {residual_n['date']}")
line("COUVERTS-> auto / residuel", f"{n_auto['pax']} / {residual_n['pax']}")
line("bookings a patcher (>=1 champ)", len(updates))
if blocked:
    print("\n  -- annulations bloquees (event encaisse, -> equipes) --")
    for eid, mlbl, blbl in blocked:
        print(f"     {eid:12} ME={mlbl:24} BS={blbl}")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour ecrire, snapshot inclus.)")
    sys.exit(0)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
snap = [{"id": m["id"], "external_id": m["external_id"], "status_id": m["status_id"],
         "event_date": m["event_date"], "guests_count": m["guests_count"]}
        for m in me.values() if m["id"] in updates]
(BACKUP_DIR / f"g1_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))


def patch(item):
    bid, cols = item
    db.patch("bookings", f"id=eq.{bid}", cols)
    return 1


with ThreadPoolExecutor(max_workers=8) as ex:
    n = sum(ex.map(patch, updates.items()))
print(f"\n  >> bookings patches : {n}")
print(f"  >> champs : statut {n_auto['status']} · date {n_auto['date']} · couverts {n_auto['pax']}")
print(f"  >> snapshot : backups/g1_snapshot_{ts}.json")
