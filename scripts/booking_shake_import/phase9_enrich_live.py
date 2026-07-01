"""Phase 9 -- Action A : enrichit les devis BS placeholder dont les lignes du document VIVANT
(facture/solde Paye/En cours, annules+avoirs ecartes) reconcilient le total STOCKE a 2%.
Total_ttc GARDE (aucune casse paiement), HT/TVA recale sur les lignes. Snapshot avant ecriture.
Dry-run par defaut ; --apply pour ecrire."""
import sys, json
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request
sys.path.insert(0, ".")
from lib import load_env, load_csv, Supa, BILLING_CSV, ORG_ID, SOURCE, s, unit_price_ht
import phase4_enrich_dryrun as p4

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
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

def dtype(d): return (s(d.get("type")) or "facture").lower()
def is_live(d): return (s(d.get("invoice_status")) or "").lower() in ("payé", "paye", "en cours")
AVOIR = {"acompte-avoir", "solde-avoir", "facture-avoir"}
def coherent(it):
    ht, ttc, tva = it["total_ht"] or 0, it["total_ttc"] or 0, it["tva_rate"] or 0
    return abs(ht * (1 + tva / 100) - ttc) <= max(0.05, 0.01 * abs(ttc))

bi = load_csv(BILLING_CSV)
bill = defaultdict(list)
for r in bi:
    e = s(r.get("event_id"))
    if e: bill[e].append(r)

quotes = get_all("quotes", "id,external_id,total_ttc,status", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
items = get_all("quote_items", "quote_id,name,item_type", f"external_source=eq.{SOURCE}")
by_q = defaultdict(list)
for it in items: by_q[it["quote_id"]].append(it)
placeholders = []
for q in quotes:
    prod = [i for i in by_q.get(q["id"], []) if i.get("item_type") != "extra"]
    if q.get("external_id") and len(prod) == 1 and "import Booking Shake" in (prod[0].get("name") or ""):
        placeholders.append(q)

def candidates(eid):
    """Parse les docs facture/solde vivants ; dedup au niveau DOCUMENT (pas par ligne, sinon les
    factures legitimement repetees par echeance s'ecrasent et le total tombe a 1/2, 1/3...). Renvoie
    les candidats : chaque doc distinct seul (prefere facture puis le + complet) + l'union des docs."""
    docs = [d for d in bill.get(eid, []) if dtype(d) in ("facture", "solde") and is_live(d) and s(d.get("url"))]
    parsed = []
    for d in docs:
        try:
            its, ok = p4.parse_lines(p4.pdftext(p4.download(s(d.get("url")))))
            if ok and its:
                parsed.append((d, its, round(sum((i["total_ttc"] or 0) for i in its), 2)))
        except Exception:
            pass
    seen, uniq = set(), []
    for d, its, sm in parsed:
        sig = tuple(sorted((i["name"], i["total_ttc"]) for i in its))
        if sig not in seen:
            seen.add(sig); uniq.append((d, its, sm))
    singles = sorted(uniq, key=lambda x: (0 if dtype(x[0]) == "facture" else 1, -x[2]))
    union = [i for _, its, _ in uniq for i in its]
    return [its for _, its, _ in singles] + ([union] if len(uniq) > 1 else [])

def evaluate(q):
    eid, st = q["external_id"], q.get("total_ttc") or 0
    if not st:
        return None
    for its in candidates(eid):
        psum = round(sum((i["total_ttc"] or 0) for i in its), 2)
        if abs(psum - st) <= max(2.0, 0.02 * st) and all(coherent(it) for it in its):
            return {"q": q, "eid": eid, "items": its, "psum": psum, "stored": st,
                    "delta": round(psum - st, 2), "status": q.get("status")}
    return None

with ThreadPoolExecutor(max_workers=12) as ex:
    safe = [r for r in ex.map(evaluate, placeholders) if r]

print(f"=== PHASE 9 -- ENRICHISSEMENT 'DOCS VIVANTS' (total garde)  [{'APPLY' if apply else 'DRY-RUN'}] ===")
print(f"  devis placeholder analyses          : {len(placeholders)}")
print(f"  enrichissables (lignes vivantes ~ total stocke a 2%, coherentes) : {len(safe)}")
print(f"  lignes a inserer                    : {sum(len(r['items']) for r in safe)}")
print(f"  total_ttc GARDE                     : oui -> aucune casse paiements")
print(f"  par statut                          : {dict(Counter(r['status'] for r in safe))}")
print(f"  ecart max lignes/total (marge <=2%) : {max((abs(r['delta']) for r in safe), default=0):.0f} EUR")
print("\n  echantillon (eid : total garde | somme lignes [ecart], n lignes, statut) :")
for r in sorted(safe, key=lambda x: -abs(x["delta"]))[:10]:
    print(f"    {r['eid']:12} {r['stored']:>9} | {r['psum']:>9} [{r['delta']:+.2f}]  {len(r['items'])}l  {r['status']}")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour enrichir, snapshot inclus.)")
    sys.exit(0)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
qids = {r["q"]["id"] for r in safe}
snap = [it for it in get_all("quote_items", "id,quote_id,name,description,quantity,unit_price,total_ht,total_ttc,tva_rate,item_type,position,external_id", f"external_source=eq.{SOURCE}") if it.get("quote_id") in qids]
(BACKUP_DIR / f"enrich9_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))

def enrich(r):
    q = r["q"]
    rows = [{"quote_id": q["id"], "external_source": SOURCE, "external_id": f"{r['eid']}:{pos}",
             "name": (it["name"] or "Prestation")[:255], "description": it["description"] or None,
             "quantity": it["quantity"], "unit_price": unit_price_ht(it),
             "total_ht": it["total_ht"], "total_ttc": it["total_ttc"],
             "tva_rate": it["tva_rate"], "item_type": "product", "position": pos}
            for pos, it in enumerate(r["items"])]
    db._req("DELETE", f"/rest/v1/quote_items?external_source=eq.{SOURCE}&quote_id=eq.{q['id']}",  # purge BS (placeholder + anciennes :pos)
            extra={"Prefer": "return=minimal"})
    db.upsert("quote_items", rows, "external_source,external_id")
    keep = q["total_ttc"]
    ht = round(sum((i["total_ht"] or 0) for i in r["items"]), 2)
    db.patch("quotes", f"id=eq.{q['id']}", {"total_ht": ht, "total_tva": round(keep - ht, 2)})
    return len(rows)

with ThreadPoolExecutor(max_workers=4) as ex:
    n = sum(ex.map(enrich, safe))
print(f"\n  >> devis enrichis : {len(safe)}")
print(f"  >> lignes inserees : {n}")
print(f"  >> snapshot : backups/enrich9_snapshot_{ts}.json")
