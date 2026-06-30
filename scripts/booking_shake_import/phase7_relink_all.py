"""Phase 7 -- rattache 100% des bookings BS orphelins a un contact (priorite : pouvoir
retrouver les devis). Lie a un contact existant par nom ; si plusieurs, prend le meilleur
(email d'abord) ; si aucun, CREE un contact depuis le client_name de l'event (+ societe si B2B).
Backfill aussi quote.contact_id depuis booking.contact_id. Snapshot avant ecriture.
Dry-run par defaut ; --apply pour ecrire."""
import sys, json, unicodedata, urllib.request
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
sys.path.insert(0, ".")
from lib import load_env, load_csv, Supa, EVENTS_CSV, ORG_ID, SOURCE, s

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
url, key, _ = load_env(); H = {"apikey": key, "Authorization": f"Bearer {key}"}
db = Supa(url, key)

def get_all(table, select, q=""):
    out, off, page = [], 0, 1000
    while True:
        u = f"{url}/rest/v1/{table}?select={select}&limit={page}&offset={off}&order=id{('&'+q) if q else ''}"
        with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=120) as r:
            c = json.loads(r.read().decode())
        out += c; off += page
        if len(c) < page: return out

def norm(x):
    if not x: return ""
    return " ".join(unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode().lower().split())

def split_name(full):
    p = full.split()
    if len(p) >= 2: return p[0], " ".join(p[1:])
    return full, full

apply = "--apply" in sys.argv
ev = load_csv(EVENTS_CSV)
ev_by_id = {s(r.get("event_id")): r for r in ev if s(r.get("event_id"))}

contacts = get_all("contacts", "id,first_name,last_name,email,company_id,external_source,external_id", f"organization_id=eq.{ORG_ID}")
name_to_contact = defaultdict(list)
for c in contacts:
    name_to_contact[norm((c.get("first_name") or "") + " " + (c.get("last_name") or ""))].append(c)
companies = get_all("companies", "id,name", f"organization_id=eq.{ORG_ID}")
comp_by_name = {}
for c in companies: comp_by_name.setdefault(norm(c.get("name")), c["id"])
bookings = get_all("bookings", "id,external_id,contact_id", f"organization_id=eq.{ORG_ID}&external_source=eq.booking_shake")
orphans = [b for b in bookings if not b.get("contact_id")]

def pick_best(cands):
    return sorted(cands, key=lambda c: (0 if c.get("email") else 1, 0 if c.get("external_id") else 1))[0]

# B2B/B2C + plan
b2b = b2c = 0
plan = {"link_single": [], "link_best": [], "create": [], "no_name": []}
to_create = {}  # external_id -> contact rec
for b in orphans:
    e = ev_by_id.get(b["external_id"], {})
    cn = s(e.get("client_name"))
    account = s(e.get("account"))
    if account: b2b += 1
    else: b2c += 1
    if not cn:
        plan["no_name"].append(b); continue
    cands = name_to_contact.get(norm(cn), [])
    if len(cands) == 1:
        plan["link_single"].append((b, cands[0]["id"]))
    elif len(cands) > 1:
        plan["link_best"].append((b, pick_best(cands)["id"], len(cands)))
    else:
        ext = "bs-relink:" + b["external_id"]
        fn, ln = split_name(cn)
        comp_id = comp_by_name.get(norm(account)) if account else None
        to_create[ext] = {"organization_id": ORG_ID, "external_source": SOURCE, "external_id": ext,
                          "first_name": fn, "last_name": ln, "source": "Booking Shake",
                          "company_id": comp_id, "_event": b["external_id"], "_booking": b["id"]}
        plan["create"].append((b, ext, cn, account))

linked_total = len(plan["link_single"]) + len(plan["link_best"]) + len(plan["create"])
print("="*68)
print(f"PHASE 7 -- RATTACHEMENT 100%  [{'APPLY' if apply else 'DRY-RUN'}]")
print("="*68)
print(f"\nB2B/B2C sur les {len(orphans)} events orphelins (via colonne 'account'):")
print(f"  B2B (event avec societe): {b2b}   |   B2C (sans societe): {b2c}")
print(f"\nPLAN (objectif: 100% des events rattaches):")
print(f"  lien direct (1 contact homonyme)        : {len(plan['link_single'])}")
print(f"  lien meilleur candidat (homonymes)      : {len(plan['link_best'])}")
print(f"  CREATION d'un contact (aucun homonyme)  : {len(plan['create'])}  (dont B2B avec societe liee: {sum(1 for _,e,_,a in plan['create'] if a and comp_by_name.get(norm(a)))})")
print(f"  sans nom d'event (non rattachable)      : {len(plan['no_name'])}")
print(f"  >> events rattaches apres operation     : {linked_total} / {len(orphans)}")

# doublons dans link_best : meme personne (email + sans-email) ?
same_person = 0
for b, cid, n in plan["link_best"]:
    cn = norm(s(ev_by_id.get(b["external_id"], {}).get("client_name")))
    cands = name_to_contact.get(cn, [])
    emails = [c.get("email") for c in cands]
    if sum(1 for em in emails if em) <= 1:  # au plus 1 a un email -> tres probablement doublon
        same_person += 1
print(f"\n  parmi les {len(plan['link_best'])} homonymes: ~{same_person} sont des DOUBLONS (meme personne email+sans-email)")
print(f"  -- echantillon creations --")
for b, ext, cn, acc in plan["create"][:10]:
    print(f"    create '{cn[:30]}'  societe={acc or '-'}")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour rattacher + creer + backfill quote.contact_id.)")
    sys.exit(0)

# ---------- APPLY ----------
BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
snap = {"bookings": [{"id": b["id"], "contact_id": None} for b in orphans],
        "quotes_before": get_all("quotes", "id,contact_id,booking_id", f"organization_id=eq.{ORG_ID}&external_source=eq.{SOURCE}")}
(BACKUP_DIR / f"relink_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))

# 1. create contacts
if to_create:
    rows = [{k: v for k, v in r.items() if not k.startswith("_")} for r in to_create.values()]
    db.upsert("contacts", rows, "organization_id,external_source,external_id")
    created = {c["external_id"]: c["id"] for c in db.get_all("contacts", "id,external_id",
              f"organization_id=eq.{ORG_ID}&external_source=eq.{SOURCE}") if (c.get("external_id") or "").startswith("bs-relink:")}
else:
    created = {}

# 2. link bookings (groupe par contact -> 1 PATCH id=in.() par contact, parallele)
from concurrent.futures import ThreadPoolExecutor
link_pairs = [(b["id"], cid) for b, cid in plan["link_single"]]
link_pairs += [(b["id"], cid) for b, cid, _ in plan["link_best"]]
link_pairs += [(b["id"], created[ext]) for b, ext, cn, acc in plan["create"] if created.get(ext)]
by_contact = defaultdict(list)
for bid, cid in link_pairs: by_contact[cid].append(bid)
def patch_bookings(item):
    cid, ids = item
    db.patch("bookings", "id=in.(%s)" % ",".join(ids), {"contact_id": cid})
    return len(ids)
with ThreadPoolExecutor(max_workers=8) as ex:
    n = sum(ex.map(patch_bookings, by_contact.items()))

# 3. backfill quote.contact_id depuis booking.contact_id (groupe par contact, parallele)
bookings2 = get_all("bookings", "id,contact_id", f"organization_id=eq.{ORG_ID}&external_source=eq.{SOURCE}")
bcontact = {b["id"]: b.get("contact_id") for b in bookings2}
quotes = get_all("quotes", "id,contact_id,booking_id", f"organization_id=eq.{ORG_ID}&external_source=eq.{SOURCE}")
q_by_contact = defaultdict(list)
for q in quotes:
    cid = bcontact.get(q.get("booking_id"))
    if not q.get("contact_id") and cid: q_by_contact[cid].append(q["id"])
def patch_quotes(item):
    cid, ids = item
    db.patch("quotes", "id=in.(%s)" % ",".join(ids), {"contact_id": cid})
    return len(ids)
with ThreadPoolExecutor(max_workers=8) as ex:
    bf = sum(ex.map(patch_quotes, q_by_contact.items()))

print(f"\n>> contacts crees: {len(created)}")
print(f">> bookings rattaches: {n}")
print(f">> quote.contact_id backfill: {bf}")
print(f">> snapshot: backups/relink_snapshot_{ts}.json")
