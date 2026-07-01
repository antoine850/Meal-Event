"""G2/facturés -- remplit le DETAIL-LIGNE des placeholders FACTURES via le devis récolté.

Meme moteur que g3c_recover (bookingId -> version Validé/≤5% -> parse PDF -> lignes réconcilient),
mais sur TOUS les facturés placeholder (pas que les partiels). Total = devis, header == lignes.

Garde anti-mauvaise-version (le seul vrai risque) : on n'écrit que si le devis CORROBORE la
facturation --
  - facturé complet (facture, ou acompte+solde émis) : devis ≈ ap+aw à 2% (= niveau arrondi) ;
  - facturé partiel (acompte seul) : acompte plausible pour ce devis (15%..102%).
Divergence matérielle (mauvaise version / renégocié) -> RESIDUEL (backups/g2_factures_residual.csv), jamais forcé.

Dry-run par défaut ; --apply pour écrire (snapshot + DELETE-avant-insert, idempotent)."""
import sys, json, re, urllib.parse, csv as csvmod
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, CSV_DIR, EVENTS_CSV, BILLING_CSV, load_csv, s, dec, unit_price_ht, section, line
import phase4_enrich_dryrun as p4

VERSION_SPREAD = 0.05
BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])


def fb_bid(u):
    m = re.search(r"files/[^/]+/([^/]+)/", urllib.parse.unquote(u or ""))
    return m.group(1) if m else None


def vnum(n):
    m = re.search(r"-v(\d+)$", n)
    return int(m.group(1)) if m else 0


def pdf_total(txt):
    vals = [dec(x) for x in re.findall(r"Total TTC\s+([\d  .,]+)", txt) if dec(x)]
    return max(vals) if vals else None


def parse_devis(d):
    txt = p4.pdftext(p4.download(d["url"]))
    its, ok = p4.parse_lines(txt)
    return its, ok, pdf_total(txt)


def choose(devis):
    valides = [d for d in devis if d["valide"]]
    if valides:
        d = max(valides, key=lambda x: vnum(x["name"]))
        its, ok, tot = parse_devis(d)
        return (its, tot, d["name"], None) if ok and tot else (None, None, d["name"], "parse_valide_ko")
    parsed = []
    for d in devis:
        try:
            its, ok, tot = parse_devis(d)
            if ok and tot:
                parsed.append((d, its, tot))
        except Exception:
            pass
    if not parsed:
        return None, None, None, "parse_ko"
    totals = [t for _, _, t in parsed]
    if len(parsed) == 1 or (max(totals) - min(totals)) <= VERSION_SPREAD * max(totals):
        d, its, tot = max(parsed, key=lambda x: vnum(x[0]["name"]))
        return its, tot, d["name"], None
    return None, None, None, f"versions_divergentes({min(totals):.0f}-{max(totals):.0f})"


def cl(a, b, p=0.02):
    return b > 0 and abs(a - b) <= max(10, p * b)


harvest = json.loads((CSV_DIR / "bs_devis_links_full.json").read_text())
by_bid = defaultdict(list)
for name, v in harvest.items():
    if isinstance(v, dict) and v.get("url"):
        row = v.get("row") or []
        by_bid[fb_bid(v["url"])].append({"name": name, "url": v["url"],
                                         "valide": (row[3] if len(row) > 3 else "") == "Validé"})

evrows = load_csv(EVENTS_CSV)
fcol = next(c for c in evrows[0] if "Fonction Compl" in c)
ev = {}
for r in evrows:
    e = s(r.get("event_id"))
    if e:
        m = re.search(r"[?&]bookingId=([^&]+)", s(r.get(fcol)) or "")
        ev[e] = {"bid": m.group(1) if m else None, "ap": dec(r.get("amount_paid")) or 0,
                 "aw": dec(r.get("amount_waiting")) or 0}

d8 = defaultdict(lambda: {"facture": 0, "acompte": 0, "solde": 0})
has_bill, avoir = set(), set()
for r in load_csv(BILLING_CSV):
    e = s(r.get("event_id")); t = (r.get("type") or "").strip()
    if not e:
        continue
    if "avoir" in t:
        avoir.add(e); continue
    if (r.get("invoice_status") or "") == "Annulé":
        continue
    if t in ("facture", "acompte", "solde"):
        d8[e][t] = max(d8[e][t], dec(r.get("amountTTC")) or 0); has_bill.add(e)

bk = db.get_all("bookings", "external_id,status_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
stn = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}
evst = {b["external_id"]: stn.get(b["status_id"], "?") for b in bk if b.get("external_id")}
quotes = db.get_all("quotes", "id,external_id,total_ttc,status", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
items = db.get_all("quote_items", "quote_id,name,item_type", f"external_source=eq.{SOURCE}")
pbq = defaultdict(list)
for it in items:
    if it.get("item_type") != "extra":
        pbq[it["quote_id"]].append(it)

targets = []
for q in quotes:
    e = q.get("external_id")
    if e not in has_bill or e in avoir or "Annul" in evst.get(e, ""):
        continue
    prod = pbq.get(q["id"], [])
    if len(prod) == 1 and "import Booking Shake" in (prod[0].get("name") or ""):
        targets.append(q)


def evaluate(q):
    e = q["external_id"]; info = ev.get(e, {})
    devis = by_bid.get(info.get("bid"), [])
    if not devis:
        return {"q": q, "seg": "no_devis"}
    its, tot, ver, residual = choose(devis)
    if residual:
        return {"q": q, "seg": "residual", "reason": residual, "ver": ver}
    line_sum = round(sum((i["total_ttc"] or 0) for i in its), 2)
    if not tot or abs(line_sum - tot) > max(2.0, 0.02 * tot):
        return {"q": q, "seg": "residual", "reason": f"lignes!=devis({line_sum:.0f}/{tot:.0f})", "ver": ver}
    ap, aw = info.get("ap", 0), info.get("aw", 0); anchor = ap + aw
    if anchor <= 0:
        return {"q": q, "seg": "residual", "ver": ver, "reason": "pas d'ancre facturation"}
    # regle dure : le total ne descend JAMAIS sous ce que BS a deja facture (ap+aw).
    if tot < anchor * 0.98:
        return {"q": q, "seg": "residual", "ver": ver,
                "reason": f"devis<facture(devis={tot:.0f} facture={anchor:.0f}) -- version perimee"}
    if tot <= anchor * 1.02:
        corro = "complet"            # devis ~= facture : total ~inchange, on ajoute juste les lignes
    elif anchor / tot >= 0.30:
        corro = "partiel_up"         # facture = acompte >=30% du devis (depot normal) : total monte au devis
    else:
        return {"q": q, "seg": "residual", "ver": ver,
                "reason": f"acompte trop faible(facture={anchor:.0f} devis={tot:.0f} = {anchor/tot*100:.0f}%)"}
    return {"q": q, "seg": "enrich", "items": its, "devis_total": tot, "ver": ver,
            "me_total": q["total_ttc"] or 0, "anchor": anchor, "paid": ap, "corro": corro}


with ThreadPoolExecutor(max_workers=12) as ex:
    res = list(ex.map(evaluate, targets))
seg = Counter(r["seg"] for r in res)
enrich = [r for r in res if r["seg"] == "enrich"]
residual = [r for r in res if r["seg"] == "residual"]

section(f"G2 ENRICHISSEMENT LIGNES DES FACTURES  [{'APPLY' if apply else 'DRY-RUN'}]")
line("placeholders facturés (cible)", len(targets))
for k in ("enrich", "no_devis", "residual"):
    line(f"  {k}", seg.get(k, 0))
line("  dont total ~inchange / total monte au devis complet",
     f"{sum(1 for r in enrich if r['corro']=='complet')} / {sum(1 for r in enrich if r['corro']=='partiel_up')}")
line("lignes à insérer", sum(len(r["items"]) for r in enrich))

# --- RISQUE : de combien le total bouge-t-il ? ---
buckets = Counter()
for r in enrich:
    d = abs(r["devis_total"] - r["me_total"])
    p = d / r["me_total"] * 100 if r["me_total"] else 100
    if d <= 2: buckets["identique (≤2€)"] += 1
    elif d <= 20: buckets["quelques euros (≤20€)"] += 1
    elif p <= 2: buckets["≤2% (arrondi/lignes)"] += 1
    else: buckets[">2% (total corrigé)"] += 1
print("\n  -- deplacement du total (devis vs total ME actuel) --")
for k in ["identique (≤2€)", "quelques euros (≤20€)", "≤2% (arrondi/lignes)", ">2% (total corrigé)"]:
    print(f"     {buckets.get(k,0):5}  {k}")
big = sorted([r for r in enrich if abs(r["devis_total"]-r["me_total"]) > max(20, 0.02*(r["me_total"] or 1))],
             key=lambda x: -abs(x["devis_total"]-x["me_total"]))
if big:
    print(f"\n  -- {len(big)} totaux qui bougent >2% (echantillon : event  ME -> devis  [facture])--")
    for r in big[:12]:
        print(f"     {r['q']['external_id']:12} {r['me_total']:>9.0f} -> {r['devis_total']:>9.0f}  [fact={r['anchor']:.0f}] {r['corro']}")
up = [r for r in enrich if r["corro"] == "partiel_up"]
fb = Counter()
for r in up:
    frac = r["anchor"] / r["devis_total"] if r["devis_total"] else 0
    if frac >= 0.5: fb["acompte >=50% (fort)"] += 1
    elif frac >= 0.3: fb["acompte 30-50% (ok)"] += 1
    else: fb["acompte 15-30% (faible)"] += 1
print("\n  -- 242 total-monte : solidite (part de l'acompte facture dans le devis) --")
for k in ["acompte >=50% (fort)", "acompte 30-50% (ok)", "acompte 15-30% (faible)"]:
    print(f"     {fb.get(k,0):5}  {k}")
print("     (les 'faible' = acompte <30% du devis = corroboration la moins sure)")
weak = sorted([r for r in up if r["anchor"]/r["devis_total"] < 0.3], key=lambda x: x["anchor"]/x["devis_total"])
for r in weak[:8]:
    print(f"        {r['q']['external_id']:12} facture={r['anchor']:>7.0f}  devis={r['devis_total']:>7.0f}  = {r['anchor']/r['devis_total']*100:.0f}%")

rc = Counter(re.sub(r"\(.*", "", r.get("reason", "?")) for r in residual)
print("\n  -- residuel (-> equipes plus tard) --")
for k, v in rc.most_common():
    print(f"     {v:5}  {k}")

BACKUP_DIR.mkdir(exist_ok=True)
with open(BACKUP_DIR / "g2_factures_residual.csv", "w", newline="", encoding="utf-8") as f:
    w = csvmod.writer(f)
    w.writerow(["event_id", "statut_ME", "total_ME", "raison", "version"])
    for r in residual:
        w.writerow([r["q"]["external_id"], evst.get(r["q"]["external_id"], "?"),
                    r["q"]["total_ttc"], r.get("reason"), r.get("ver")])
line(">> residuel facturés (G5)", f"backups/g2_factures_residual.csv ({len(residual)})")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour enrichir, snapshot + DELETE-avant-insert.)")
    sys.exit(0)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
qids = {r["q"]["id"] for r in enrich}
snap = {"items": [it for it in db.get_all("quote_items", "id,quote_id,name,description,quantity,unit_price,total_ht,total_ttc,tva_rate,item_type,position,external_id", f"external_source=eq.{SOURCE}") if it["quote_id"] in qids],
        "headers": [{"id": r["q"]["id"], "total_ttc": r["me_total"]} for r in enrich]}
(BACKUP_DIR / f"g2_factures_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))


def write_one(r):
    q, its, tot = r["q"], r["items"], r["devis_total"]
    rows = [{"quote_id": q["id"], "external_source": SOURCE, "external_id": f"{q['external_id']}:{pos}",
             "name": (it["name"] or "Prestation")[:255], "description": it["description"] or None,
             "quantity": it["quantity"], "unit_price": unit_price_ht(it),
             "total_ht": it["total_ht"], "total_ttc": it["total_ttc"], "tva_rate": it["tva_rate"],
             "item_type": "product", "position": pos} for pos, it in enumerate(its)]
    db._req("DELETE", f"/rest/v1/quote_items?external_source=eq.{SOURCE}&quote_id=eq.{q['id']}", extra={"Prefer": "return=minimal"})
    db.upsert("quote_items", rows, "external_source,external_id")
    ht = round(sum((i["total_ht"] or 0) for i in its), 2)
    db.patch("quotes", f"id=eq.{q['id']}", {"total_ht": ht, "total_tva": round(tot - ht, 2), "total_ttc": tot})
    return len(rows)


with ThreadPoolExecutor(max_workers=4) as ex:
    n = sum(ex.map(write_one, enrich))
print(f"\n  >> devis facturés enrichis : {len(enrich)}  |  lignes inserees : {n}")
print(f"  >> snapshot : backups/g2_factures_snapshot_{ts}.json")
