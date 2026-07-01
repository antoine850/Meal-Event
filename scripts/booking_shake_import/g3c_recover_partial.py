"""G3/C -- recupere le total des facturés placeholder PARTIELS (acompte seul, pas de solde emis)
via le vrai devis recolte. Meme moteur que enrich_devis_pdf (map bookingId -> version -> parse),
+ garde-fou : le devis recupere doit corroborer l'acompte deja paye (devis >= acompte, ratio sain).
Cas OK -> on enrichit lignes + total = devis. Cas ambigus -> residuel/equipes.
Dry-run par defaut ; --apply pour ecrire (snapshot + DELETE-avant-insert)."""
import sys, json, re, urllib.parse
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


# devis recoltes indexes par bookingId
harvest = json.loads((CSV_DIR / "bs_devis_links_full.json").read_text())
by_bid = defaultdict(list)
for name, v in harvest.items():
    if isinstance(v, dict) and v.get("url"):
        row = v.get("row") or []
        by_bid[fb_bid(v["url"])].append({"name": name, "url": v["url"],
                                         "valide": (row[3] if len(row) > 3 else "") == "Validé"})

# doc7 : ap/aw + bookingId ; doc8 actifs : acompte/solde/facture + acompte paye
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


def cl(a, b, p=0.02):
    return b > 0 and abs(a - b) <= max(5, p * b)


bk = db.get_all("bookings", "external_id,status_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
stn = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}
evst = {b["external_id"]: stn.get(b["status_id"], "?") for b in bk if b.get("external_id")}
quotes = db.get_all("quotes", "id,external_id,total_ttc,status", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
items = db.get_all("quote_items", "quote_id,name,item_type", f"external_source=eq.{SOURCE}")
pbq = defaultdict(list)
for it in items:
    if it.get("item_type") != "extra":
        pbq[it["quote_id"]].append(it)

# les 21 : placeholder facturé, total faux, acompte seul (pas de facture complete corroboree)
partiels = []
for q in quotes:
    e = q.get("external_id")
    if e not in has_bill or e in avoir or "Annul" in evst.get(e, ""):
        continue
    prod = pbq.get(q["id"], [])
    if not (len(prod) == 1 and "import Booking Shake" in (prod[0].get("name") or "")):
        continue
    binv = ev.get(e, {}).get("ap", 0) + ev.get(e, {}).get("aw", 0)
    mt = q.get("total_ttc") or 0
    if binv <= 0 or abs(mt - binv) <= max(2, 0.02 * binv):
        continue
    f, a, so = d8[e]["facture"], d8[e]["acompte"], d8[e]["solde"]
    if (f and cl(binv, f)) or (a and so and cl(binv, a + so)):
        continue  # facture complete -> deja traite par g3c cœur
    partiels.append(q)


def evaluate(q):
    e = q["external_id"]
    info = ev.get(e, {})
    devis = by_bid.get(info.get("bid"), [])
    acc = d8[e]["acompte"]
    if not devis:
        return {"q": q, "seg": "no_devis"}
    its, tot, ver, residual = choose(devis)
    if residual:
        return {"q": q, "seg": "residual", "reason": residual, "ver": ver}
    line_sum = round(sum((i["total_ttc"] or 0) for i in its), 2)
    if not tot or abs(line_sum - tot) > max(2.0, 0.02 * tot):
        return {"q": q, "seg": "residual", "reason": f"lignes!=devis({line_sum}/{tot})", "ver": ver}
    if acc > tot * 1.02 or acc < tot * 0.15:
        return {"q": q, "seg": "residual", "reason": f"acompte_incoherent(acc={acc:.0f}/devis={tot:.0f})", "ver": ver}
    return {"q": q, "seg": "recover", "items": its, "devis_total": tot, "ver": ver,
            "me_total": q["total_ttc"] or 0, "acc": acc}


with ThreadPoolExecutor(max_workers=10) as ex:
    res = list(ex.map(evaluate, partiels))
seg = Counter(r["seg"] for r in res)
rec = [r for r in res if r["seg"] == "recover"]
residual = [r for r in res if r["seg"] == "residual"]

section(f"G3/C RECUPERATION PARTIELS (devis recolte + garde acompte)  [{'APPLY' if apply else 'DRY-RUN'}]")
line("placeholders partiels (acompte seul)", len(partiels))
for k in ("recover", "no_devis", "residual"):
    line(f"  {k}", seg.get(k, 0))
print("\n  -- recuperables (event : ME -> devis, acompte, ratio acc/devis, version, n lignes) --")
for r in sorted(rec, key=lambda x: -x["devis_total"]):
    print(f"     {r['q']['external_id']:12} {r['me_total']:>8} -> {r['devis_total']:>8}  acc={r['acc']:>7.0f}  {r['acc']/r['devis_total']*100:>3.0f}%  {r['ver'][:24]:24} {len(r['items'])}l")
if residual:
    print("\n  -- residuel (-> equipes) --")
    for r in residual:
        print(f"     {r['q']['external_id']:12} {r.get('reason','?')}")

# fichier residuel C (partiels ambigus + avoirs factures au total faux) pour g5
import csv as csvmod
avoir_faux = []
for q in quotes:
    e = q.get("external_id")
    if e in avoir and e in has_bill and "Annul" not in evst.get(e, ""):
        binv = ev.get(e, {}).get("ap", 0) + ev.get(e, {}).get("aw", 0)
        mt = q.get("total_ttc") or 0
        if binv > 0 and abs(mt - binv) > max(2, 0.02 * binv):
            avoir_faux.append((e, q.get("status"), round(mt, 2)))
BACKUP_DIR.mkdir(exist_ok=True)
with open(BACKUP_DIR / "g3_residual_totaux.csv", "w", newline="", encoding="utf-8") as f:
    w = csvmod.writer(f)
    w.writerow(["event_id", "categorie", "total_ME", "detail"])
    for r in residual:
        w.writerow([r["q"]["external_id"], "devis_ambigu", r["q"]["total_ttc"], r.get("reason", "?")])
    for e, st, mt in avoir_faux:
        w.writerow([e, "avoir", mt, "avoir present, total a trancher"])
line(">> residuel C (G5)", f"backups/g3_residual_totaux.csv ({len(residual)} devis-ambigu + {len(avoir_faux)} avoir)")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour enrichir, snapshot + DELETE-avant-insert.)")
    sys.exit(0)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
qids = {r["q"]["id"] for r in rec}
snap = {"items": [it for it in db.get_all("quote_items", "id,quote_id,name,description,quantity,unit_price,total_ht,total_ttc,tva_rate,item_type,position,external_id", f"external_source=eq.{SOURCE}") if it["quote_id"] in qids],
        "headers": [{"id": r["q"]["id"], "total_ttc": r["me_total"]} for r in rec]}
(BACKUP_DIR / f"g3c_recover_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))


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
    n = sum(ex.map(write_one, rec))
print(f"\n  >> devis recuperes : {len(rec)}  |  lignes inserees : {n}")
print(f"  >> snapshot : backups/g3c_recover_snapshot_{ts}.json")
