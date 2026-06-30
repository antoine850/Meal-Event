"""Phase 8 -- enrichit les devis BS placeholder dont les lignes PDF reconcilient le total
STOCKE a 2% pres (perimetre sur, valide avec le user). Insere les vraies lignes, supprime le
placeholder, recale le header sur les lignes (total bouge de <=2%). Snapshot avant ecriture.
Dry-run par defaut ; --apply pour ecrire."""
import sys, json, glob
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, ".")
from lib import load_env, load_csv, Supa, BILLING_CSV, ORG_ID, SOURCE, s, section, line, unit_price_ht
import phase4_enrich_dryrun as p4

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv

redo = json.loads(open(sorted(glob.glob("backups/enrich_redo_candidates_*.json"))[-1]).read())
stored = {r["event_id"]: r["total_ttc"] for r in redo}
statusmap = {r["event_id"]: r["status"] for r in redo}
bi = load_csv(BILLING_CSV)
bill = defaultdict(list)
for r in bi:
    eid = s(r.get("event_id"))
    if eid in stored:
        bill[eid].append(r)

def coherent(it):
    ht, ttc, tva = it["total_ht"] or 0, it["total_ttc"] or 0, it["tva_rate"] or 0
    return abs(ht * (1 + tva / 100) - ttc) <= max(0.05, 0.01 * abs(ttc))

def parse_union(eid):
    docs = [d for d in bill.get(eid, []) if p4.dtype(d) in ("facture", "solde") and s(d.get("url"))]
    items = []
    for d in docs:
        try:
            its, ok = p4.parse_lines(p4.pdftext(p4.download(s(d.get("url")))))
            if ok:
                items += its
        except Exception:
            pass
    seen, uniq = set(), []
    for it in items:
        k = (it["name"], it["total_ttc"])
        if k not in seen:
            seen.add(k); uniq.append(it)
    return uniq

def evaluate(eid):
    items = parse_union(eid)
    if not items:
        return None
    psum = round(sum((i["total_ttc"] or 0) for i in items), 2)
    st = stored.get(eid) or 0
    if st and abs(psum - st) <= max(2.0, 0.02 * st) and all(coherent(it) for it in items):
        return {"eid": eid, "items": items, "psum": psum, "stored": st,
                "delta": round(psum - st, 2), "status": statusmap.get(eid)}
    return None

with ThreadPoolExecutor(max_workers=12) as ex:
    safe = [r for r in ex.map(evaluate, list(stored)) if r]

from collections import Counter
section(f"PHASE 8 -- ENRICHISSEMENT PERIMETRE SUR (lignes ~ total stocke a 2pct)  [{'APPLY' if apply else 'DRY-RUN'}]")
line("devis enrichissables", len(safe))
line("lignes a inserer", sum(len(r["items"]) for r in safe))
line("total_ttc GARDE (montant facture/paye)", "oui -> aucune casse paiements")
line("devis avec ecart lignes/total (marge <=2%)", sum(1 for r in safe if abs(r["delta"]) >= 0.5))
line("ecart max lignes vs total", f"{max((abs(r['delta']) for r in safe), default=0):.0f} EUR")
line("par statut", dict(Counter(r["status"] for r in safe)))
print("\n  echantillon (eid : total garde | somme lignes [ecart], statut) :")
for r in sorted(safe, key=lambda x: -abs(x["delta"]))[:12]:
    print(f"    {r['eid']:12} {r['stored']:>9} -> {r['psum']:>9}  [{r['delta']:+.2f}]  {r['status']}  ({len(r['items'])} lignes)")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour enrichir, snapshot inclus.)")
    sys.exit(0)

url, key, _ = load_env()
db = Supa(url, key)
orgf = f"organization_id=eq.{ORG_ID}"
quotes = {q["external_id"]: q for q in db.get_all("quotes", "id,external_id,total_ttc",
          f"external_source=eq.{SOURCE}&{orgf}") if q.get("external_id")}
work = [r for r in safe if r["eid"] in quotes]

# snapshot des quote_items concernes + headers
BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
qids = [quotes[r["eid"]]["id"] for r in work]
snap_items = db.get_all("quote_items", "id,quote_id,name,description,quantity,unit_price,total_ht,total_ttc,tva_rate,item_type,position,external_id",
                        f"external_source=eq.{SOURCE}")
snap = {"items": [it for it in snap_items if it.get("quote_id") in set(qids)],
        "headers": [{"id": quotes[r["eid"]]["id"], "total_ttc": quotes[r["eid"]]["total_ttc"]} for r in work]}
(BACKUP_DIR / f"enrich_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))
line("snapshot ecrit", f"enrich_snapshot_{ts}.json")

def enrich(r):
    q = quotes[r["eid"]]
    rows = [{"quote_id": q["id"], "external_source": SOURCE, "external_id": f"{r['eid']}:{pos}",
             "name": (it["name"] or "Prestation")[:255], "description": it["description"] or None,
             "quantity": it["quantity"], "unit_price": unit_price_ht(it),
             "total_ht": it["total_ht"], "total_ttc": it["total_ttc"],
             "tva_rate": it["tva_rate"], "item_type": "product", "position": pos}
            for pos, it in enumerate(r["items"])]
    db._req("DELETE", f"/rest/v1/quote_items?external_source=eq.{SOURCE}&quote_id=eq.{q['id']}",  # purge BS (placeholder + anciennes :pos)
            extra={"Prefer": "return=minimal"})
    db.upsert("quote_items", rows, "external_source,external_id")
    # On GARDE le total_ttc stocke (montant facture/paye) -> aucune casse de la reconciliation
    # paiements. On recale juste le HT/TVA du header sur les vraies lignes.
    keep = q["total_ttc"] if q["total_ttc"] is not None else r["stored"]
    ht = round(sum((i["total_ht"] or 0) for i in r["items"]), 2)
    db.patch("quotes", f"id=eq.{q['id']}",
             {"total_ht": ht, "total_tva": round(keep - ht, 2)})
    return len(rows)

with ThreadPoolExecutor(max_workers=4) as ex:
    n = sum(ex.map(enrich, work))
line(">> devis enrichis", len(work))
line(">> lignes inserees", n)
line(">> snapshot", f"backups/enrich_snapshot_{ts}.json")
