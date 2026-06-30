"""Arbitre activity_logs (LECTURE SEULE, n'ecrit RIEN en base).

Pour chaque event BS-sourced et chaque champ qui DIVERGE entre BS-frais (document (7).csv) et ME-live,
decide la source de verite via activity_logs (regle asymetrique, sans timestamp BS) :
  - un user ME a edite ce champ APRES l'import (boundary 2026-06-04) -> ME a une valeur humaine =>
    on ne peut pas l'ordonner contre une eventuelle edition BS => RESIDUEL (a arbitrer par les equipes) ;
  - aucune edition user ME sur ce champ -> la valeur ME vient de l'import => BS plus recent => BS-AUTO.

Champs traces par les logs : booking.status_changed {old_status,new_status}, booking.updated
{changes:{Date,Convives,...}} (tous actor_type=user). Champs NON traces (menu/allergies/horaires/acompte)
ne passent pas par cet arbitre : pour eux, ne jamais auto-ecraser ME, toute divergence BS!=ME -> residuel.

Sorties (backups/) : le fichier minimal d'incoherences (G5) + les listes BS-applicables (G1).
Usage : python3 scripts/booking_shake_import/arbiter_activity_logs.py
"""
import sys
import csv as csvmod
from collections import defaultdict, Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, STATUS_TO_ID, CSV_DIR, load_csv, date_iso, s, section, line

IMPORT_BOUNDARY = "2026-06-04T21:00:00"  # juste apres l'import bulk (updated_at ~20:53 le 04/06)
EVENTS_CSV = CSV_DIR / "document (7).csv"
BACKUP_DIR = Path(__file__).resolve().parent / "backups"
db = Supa(*load_env()[:2])


def write_csv(name, header, rows):
    BACKUP_DIR.mkdir(exist_ok=True)
    with open(BACKUP_DIR / name, "w", newline="", encoding="utf-8") as f:
        w = csvmod.writer(f)
        w.writerow(header)
        w.writerows(rows)
    return len(rows)


# 1. BS frais : event_id -> {status, date, pax}
bs = {}
for r in load_csv(EVENTS_CSV):
    eid = s(r.get("event_id"))
    if eid:
        bs[eid] = {"status": s(r.get("status")),
                   "date": date_iso(r.get("date_event")) or s(r.get("date_event")),
                   "pax": s(r.get("pax"))}

# 2. ME bookings BS-sourced
bk = db.get_all("bookings", "id,external_id,status_id,event_date,guests_count",
                f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
me = {b["external_id"]: b for b in bk if b.get("external_id")}

# 3. statuses : id -> label (pour l'affichage du fichier equipes)
st = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}

# 4. activity_logs : editions USER post-import, par booking et par axe
logs = db.get_all("activity_logs", "booking_id,action_type,actor_name,metadata,created_at",
                  f"organization_id=eq.{ORG_ID}&actor_type=eq.user")
edited = defaultdict(dict)  # booking_id -> {axis: (editor, date)}
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


def pax_int(v):
    try:
        return int(float(str(v).replace(",", ".")))
    except (ValueError, TypeError):
        return None


# 5. comparaison par axe + verdict
residual, auto_status, auto_date, auto_pax = [], [], [], []
diffs, unknown_status = Counter(), 0

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
        diffs["status"] += 1
        bs_lbl, me_lbl = st.get(bs_sid, b["status"]), st.get(m["status_id"], m["status_id"])
        if "status" in ax:
            residual.append((eid, "statut", bs_lbl, me_lbl, ax["status"][0], ax["status"][1]))
        else:
            auto_status.append((eid, me_lbl, bs_lbl))

    if b["date"] and m["event_date"] and b["date"] != m["event_date"]:
        diffs["date"] += 1
        if "date" in ax:
            residual.append((eid, "date", b["date"], m["event_date"], ax["date"][0], ax["date"][1]))
        else:
            auto_date.append((eid, m["event_date"], b["date"]))

    bp, mp = pax_int(b["pax"]), pax_int(m["guests_count"])
    if bp is not None and mp is not None and bp != mp:
        diffs["pax"] += 1
        if "pax" in ax:
            residual.append((eid, "pax", bp, mp, ax["pax"][0], ax["pax"][1]))
        else:
            auto_pax.append((eid, mp, bp))

# 6. ecriture des sorties (CSV, pas de DB)
n_res = write_csv("arbiter_residual.csv",
                  ["event_id", "axe", "valeur_BS", "valeur_ME", "dernier_editeur_ME", "date_edition_ME"],
                  sorted(residual))
write_csv("arbiter_auto_status.csv", ["event_id", "statut_ME_actuel", "statut_BS_a_appliquer"], auto_status)
write_csv("arbiter_auto_date.csv", ["event_id", "date_ME", "date_BS"], auto_date)
write_csv("arbiter_auto_pax.csv", ["event_id", "pax_ME", "pax_BS"], auto_pax)

section("ARBITRE activity_logs (LECTURE SEULE) -- boundary import = " + IMPORT_BOUNDARY[:10])
line("events BS compares (presents BS frais ET ME)", sum(1 for e in bs if e in me))
line("statuts BS non mappes (a verifier)", unknown_status)
print()
for axis, label in (("status", "STATUT"), ("date", "DATE"), ("pax", "COUVERTS")):
    res_n = sum(1 for r in residual if r[1] in (axis, "statut" if axis == "status" else axis))
    auto_n = {"status": len(auto_status), "date": len(auto_date), "pax": len(auto_pax)}[axis]
    line(f"{label} : divergences", diffs[axis])
    line(f"  -> BS-AUTO (ME pas touche depuis l'import)", auto_n)
    line(f"  -> RESIDUEL (user ME a edite -> equipes)", diffs[axis] - auto_n)
print()
line(">> fichier minimal incoherences (G5)", f"backups/arbiter_residual.csv ({n_res} lignes)")
line(">> BS applicable auto (G1)", f"statut {len(auto_status)} / date {len(auto_date)} / pax {len(auto_pax)}")
print("\n  -- echantillon residuel (a arbitrer par les equipes) --")
for r in sorted(residual)[:12]:
    print(f"     {r[0]:12} {r[1]:7} BS={str(r[2])[:22]:22} ME={str(r[3])[:22]:22} (edit {r[4]} {r[5]})")
