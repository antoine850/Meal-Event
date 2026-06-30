"""Phase 7 (DRY-RUN, lecture seule) -- prepare deux corrections, sans rien ecrire :
  1. re-rattachement des bookings BS orphelins (contact_id null) a leur contact par nom
     (l'import phase2 ne liait que par email). auto = 1 seul contact homonyme ; sinon a revoir.
  2. liste des devis encore en placeholder MAIS qui ont une facture/solde PDF
     (enrichissement phase4/6 a reprendre : parsing/reconciliation KO).
Ecrit deux JSON dans backups/ pour validation avant tout UPDATE.
"""
import sys, json, unicodedata, urllib.request
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
sys.path.insert(0, ".")
from lib import load_env, load_csv, EVENTS_CSV, BILLING_CSV, ORG_ID, s, dec

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
url, key, _ = load_env(); H = {"apikey": key, "Authorization": f"Bearer {key}"}

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

def dtype(d): return (s(d.get("type")) or "facture").lower()

ev = load_csv(EVENTS_CSV); bi = load_csv(BILLING_CSV)
ev_by_id = {s(r.get("event_id")): r for r in ev if s(r.get("event_id"))}
bill_by_event = defaultdict(list)
for r in bi:
    eid = s(r.get("event_id"))
    if eid: bill_by_event[eid].append(r)

contacts = get_all("contacts", "id,first_name,last_name,email,external_source,external_id", f"organization_id=eq.{ORG_ID}")
name_to_contact = defaultdict(list)
for c in contacts:
    name_to_contact[norm((c.get("first_name") or "") + " " + (c.get("last_name") or ""))].append(c)
bookings = get_all("bookings", "id,external_id,contact_id", f"organization_id=eq.{ORG_ID}&external_source=eq.booking_shake")
quotes = get_all("quotes", "id,external_id,booking_id,quote_number,total_ttc,status,contact_id", f"organization_id=eq.{ORG_ID}&external_source=eq.booking_shake")
items = get_all("quote_items", "quote_id,name,item_type", "external_source=eq.booking_shake")

q_by_booking = defaultdict(list)
for q in quotes: q_by_booking[q.get("booking_id")].append(q)
items_by_q = defaultdict(list)
for it in items: items_by_q[it["quote_id"]].append(it)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")

# ---------- 1. RE-RATTACHEMENT ----------
orphans = [b for b in bookings if not b.get("contact_id")]
relink = {"auto": [], "review_ambiguous": [], "review_nomatch": [], "no_name": []}
for b in orphans:
    e = ev_by_id.get(b["external_id"], {})
    cn = s(e.get("client_name"))
    devis = [{"quote_number": q.get("quote_number"), "total_ttc": q.get("total_ttc"), "status": q.get("status")}
             for q in q_by_booking.get(b["id"], [])]
    rec = {"booking_id": b["id"], "event_id": b["external_id"], "client_name": cn,
           "event_email": s(e.get("client_email")), "n_devis": len(devis), "devis": devis}
    if not cn:
        relink["no_name"].append(rec); continue
    cands = name_to_contact.get(norm(cn), [])
    rec["candidates"] = [{"id": c["id"], "name": f"{c.get('first_name')} {c.get('last_name')}",
                          "email": c.get("email"), "source": c.get("external_source")} for c in cands]
    if len(cands) == 1:
        rec["proposed_contact_id"] = cands[0]["id"]
        relink["auto"].append(rec)
    elif len(cands) > 1:
        relink["review_ambiguous"].append(rec)
    else:
        relink["review_nomatch"].append(rec)

relink_file = BACKUP_DIR / f"orphan_relink_dryrun_{ts}.json"
relink_file.write_text(json.dumps(relink, ensure_ascii=False, indent=1))

# ---------- 2. ENRICHISSEMENT A REPRENDRE ----------
placeholder = []
for q in quotes:
    its = [it for it in items_by_q.get(q["id"], []) if it.get("item_type") != "extra"]
    if len(its) == 1 and "import Booking Shake" in (its[0].get("name") or ""):
        placeholder.append(q)
redo = []
for q in placeholder:
    docs = bill_by_event.get(q["external_id"], [])
    detail = [d for d in docs if dtype(d) in ("facture", "solde")]
    detail_urls = [s(d.get("url")) for d in detail if s(d.get("url"))]
    if detail_urls:
        redo.append({"event_id": q["external_id"], "quote_number": q.get("quote_number"),
                     "total_ttc": q.get("total_ttc"), "status": q.get("status"),
                     "doc_types": sorted({dtype(d) for d in detail}), "n_urls": len(detail_urls)})
redo_file = BACKUP_DIR / f"enrich_redo_candidates_{ts}.json"
redo_file.write_text(json.dumps(redo, ensure_ascii=False, indent=1))

# ---------- RAPPORT ----------
def euros(v): return f"{(v or 0):,.0f}".replace(",", " ")
print("=" * 70)
print("PHASE 7 -- DRY-RUN (aucune ecriture)")
print("=" * 70)
print(f"\n[1] RE-RATTACHEMENT BOOKINGS ORPHELINS  ({len(orphans)} orphelins)")
print(f"  AUTO (1 seul contact homonyme, rattachable directement) : {len(relink['auto'])}")
print(f"  A REVOIR - plusieurs homonymes                          : {len(relink['review_ambiguous'])}")
print(f"  A REVOIR - aucun contact homonyme                       : {len(relink['review_nomatch'])}")
print(f"  sans nom d'event                                        : {len(relink['no_name'])}")
auto_devis = sum(r["n_devis"] for r in relink["auto"])
print(f"  -> devis rendus visibles par l'AUTO                     : {auto_devis}")
print(f"\n  -- echantillon AUTO (booking -> contact propose) --")
for r in sorted(relink["auto"], key=lambda x: -(x["devis"][0]["total_ttc"] if x["devis"] else 0))[:12]:
    d = r["devis"][0] if r["devis"] else {}
    print(f"    {r['client_name'][:24]:24} ev={r['event_id']} -> contact={r['proposed_contact_id'][:8]} "
          f"| devis {euros(d.get('total_ttc'))}EUR {d.get('status','')}")
print(f"\n  -- echantillon A REVOIR (homonymes) --")
for r in relink["review_ambiguous"][:8]:
    print(f"    {r['client_name'][:24]:24} ev={r['event_id']} -> {len(r['candidates'])} candidats: "
          + " | ".join(f"{c['email'] or 'sans-email'}({c['source'] or 'manuel'})" for c in r["candidates"][:4]))

print(f"\n[2] ENRICHISSEMENT A REPRENDRE (placeholder + facture/solde PDF present) : {len(redo)}")
print(f"  types de docs:", dict(Counter(t for r in redo for t in r["doc_types"])))
print(f"  -- echantillon (par montant) --")
for r in sorted(redo, key=lambda x: -(x["total_ttc"] or 0))[:12]:
    print(f"    ev={r['event_id']} {euros(r['total_ttc'])}EUR {r['status']:14} docs={','.join(r['doc_types'])} ({r['n_urls']} pdf)")

print(f"\nFichiers ecrits (a valider) :")
print(f"  {relink_file}")
print(f"  {redo_file}")
