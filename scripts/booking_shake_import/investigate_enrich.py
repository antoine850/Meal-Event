"""Investigation (lecture seule) : pour les 276 devis placeholder-avec-PDF, croise les lignes
parsees (PDF, cache) avec le CSV de facturation pour comprendre POURQUOI le total ne colle pas,
et trouver a quel total reel les lignes se reconcilient (a 2%). Categorise les incoherences :
total gonfle par l'attente, multi-docs, avoir/annulation, montant errone."""
import sys, json, glob
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, ".")
from lib import load_csv, BILLING_CSV, EVENTS_CSV, s, dec
import phase4_enrich_dryrun as p4

redo = json.loads(open(sorted(glob.glob("backups/enrich_redo_candidates_*.json"))[-1]).read())
target = {r["event_id"] for r in redo}
stored = {r["event_id"]: r["total_ttc"] for r in redo}
status = {r["event_id"]: r["status"] for r in redo}

bi = load_csv(BILLING_CSV)
bill = defaultdict(list)
for r in bi:
    eid = s(r.get("event_id"))
    if eid in target:
        bill[eid].append(r)
ev = {s(e.get("event_id")): e for e in load_csv(EVENTS_CSV) if s(e.get("event_id")) in target}

AVOIR = {"acompte-avoir", "solde-avoir", "facture-avoir"}

def near(a, b, tol=0.02, floor=2.0):
    return a is not None and b is not None and b != 0 and abs(a - b) <= max(floor, tol * abs(b))

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
    # dedup lignes identiques (meme doc emis 2x)
    seen, uniq = set(), []
    for it in items:
        k = (it["name"], it["total_ttc"])
        if k not in seen:
            seen.add(k); uniq.append(it)
    return round(sum((i["total_ttc"] or 0) for i in uniq), 2), len(uniq)

def analyze(eid):
    docs = bill.get(eid, [])
    e = ev.get(eid, {})
    ap = dec(e.get("amount_paid")) or 0
    aw = dec(e.get("amount_waiting")) or 0
    st = stored.get(eid) or 0
    psum, nlines = parse_union(eid)
    by_type = Counter(p4.dtype(d) for d in docs)
    has_avoir = any(p4.dtype(d) in AVOIR for d in docs)
    fac = round(sum(dec(d.get("amountTTC")) or 0 for d in docs if p4.dtype(d) == "facture"), 2)
    sol = round(sum(dec(d.get("amountTTC")) or 0 for d in docs if p4.dtype(d) == "solde"), 2)
    nonavoir = round(sum(dec(d.get("amountTTC")) or 0 for d in docs if p4.dtype(d) not in AVOIR and p4.dtype(d) != "acompte"), 2)
    avoir = round(sum(dec(d.get("amountTTC")) or 0 for d in docs if p4.dtype(d) in AVOIR), 2)

    # a quel total les LIGNES parsees se reconcilient-elles (2%) ?
    cands = {"stored": st, "event_total": round(ap + aw), "amount_paid": round(ap),
             "facture_ttc": fac, "solde_ttc": sol, "nonavoir_sum": nonavoir,
             "net_apres_avoir": round(nonavoir - avoir, 2)}
    matches = [k for k, v in cands.items() if near(psum, v)]

    if "stored" in matches:
        cat = "ENRICHIR_TEL_QUEL"
    elif not psum:
        cat = "0_ligne_parsee"
    elif matches:
        # les lignes collent a un total < stored -> le total devis est trop haut
        if has_avoir and near(psum, cands["net_apres_avoir"]):
            cat = "AVOIR_ANNULATION"
        elif near(psum, cands["amount_paid"]) and aw > 0.02 * (ap + aw):
            cat = "TOTAL_GONFLE_PAR_ATTENTE"  # total = paye + attente, reel = paye
        elif near(psum, cands["facture_ttc"]) or near(psum, cands["nonavoir_sum"]):
            cat = "TOTAL_VS_FACTURE"
        else:
            cat = "MATCH_AUTRE_TOTAL"
    else:
        cat = "INEXPLIQUE"
    proposed = None
    if cat not in ("ENRICHIR_TEL_QUEL", "0_ligne_parsee", "INEXPLIQUE"):
        proposed = psum  # le total reel = somme des lignes parsees
    return {"eid": eid, "cat": cat, "psum": psum, "nlines": nlines, "stored": st,
            "amount_paid": round(ap), "amount_waiting": round(aw), "facture": fac,
            "avoir": avoir, "types": dict(by_type), "matches": matches,
            "proposed_total": proposed, "status": status.get(eid)}

eids = [r["event_id"] for r in redo]
with ThreadPoolExecutor(max_workers=12) as ex:
    res = list(ex.map(analyze, eids))

cats = Counter(r["cat"] for r in res)
print("=== CATEGORIES D'INCOHERENCE (276 placeholder avec PDF) ===")
for c, n in cats.most_common():
    print(f"  {n:>4}  {c}")

norm = [r for r in res if r["proposed_total"] is not None]
print(f"\n  -> NORMALISABLES (lignes reconcilient un total < stored, total corrigeable): {len(norm)}")
print(f"  -> ENRICHIR TEL QUEL (lignes == total stocke a 2%): {cats['ENRICHIR_TEL_QUEL']}")
print(f"  -> INEXPLIQUE (aucun total ne colle): {cats['INEXPLIQUE']}")

print("\n=== echantillons par categorie ===")
for cat in ["TOTAL_GONFLE_PAR_ATTENTE", "TOTAL_VS_FACTURE", "AVOIR_ANNULATION", "MATCH_AUTRE_TOTAL", "INEXPLIQUE"]:
    exs = [r for r in res if r["cat"] == cat][:5]
    if not exs:
        continue
    print(f"\n[{cat}]")
    for r in exs:
        print(f"  {r['eid']}: lignes={r['psum']} | stored={r['stored']} paye={r['amount_paid']} attente={r['amount_waiting']} "
              f"facture={r['facture']} avoir={r['avoir']} | docs={r['types']} -> propose={r['proposed_total']}")

out = f"backups/enrich_investigation_{__import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
open(out, "w").write(json.dumps(res, ensure_ascii=False, indent=1))
print(f"\n  detail complet: {out}")
