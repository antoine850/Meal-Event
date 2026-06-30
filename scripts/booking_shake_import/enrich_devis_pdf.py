"""Enrichissement DEVIS-PDF (forecast) : remplace la ligne placeholder par les vraies lignes du devis
recolte (bs_devis_links_full.json), pour les events forecast actifs sans paiement.

Segmentation (le "1572 matche" n'est pas que du forecast) :
  - event Annule (doc7) -> SKIP (l'arbitre applique l'annulation) ;
  - facture/solde live (doc8) OU acompte deja paye (amount_paid>0) -> route FACTURE-path, pas ici ;
  - sinon forecast actif sans paiement -> enrichi ici.

Decisions actees :
  - version : "Valide" d'abord ; sinon derniere version SI l'ecart entre versions <= 5%, sinon RESIDUEL ;
  - total : on REMPLACE le total ME (vieille valeur d'import, souvent fausse) par le vrai total du devis.
  - unit_price stocke en HT (lib.unit_price_ht) ; lignes reconciliees au total du DEVIS (pas au total ME).

Tout cas ambigu (pas de version sure, parsing KO, lignes != total devis) -> RESIDUEL (backups/g2_residual_devis.csv).
Dry-run par defaut ; --apply pour ecrire (snapshot + DELETE-avant-insert, idempotent). N'ecrit rien sans --apply.
"""
import sys, json, re, urllib.parse, csv as csvmod
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, CSV_DIR, load_csv, s, dec, unit_price_ht, section, line
import phase4_enrich_dryrun as p4
from collections import defaultdict, Counter

VERSION_SPREAD = 0.05
BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
limit = next((int(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--limit=")), None)
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


# --- inputs ---
harvest = json.loads((CSV_DIR / "bs_devis_links_full.json").read_text())
by_bid = defaultdict(list)
for name, v in harvest.items():
    if isinstance(v, dict) and v.get("url"):
        row = v.get("row") or []
        by_bid[fb_bid(v["url"])].append({"name": name, "url": v["url"],
                                         "valide": (row[3] if len(row) > 3 else "") == "Validé"})

ev = load_csv(CSV_DIR / "document (7).csv")
col = next(c for c in ev[0] if "Fonction Compl" in c)
ev_info = {}
for r in ev:
    eid = s(r.get("event_id"))
    if eid:
        m = re.search(r"[?&]bookingId=([^&]+)", s(r.get(col)) or "")
        ev_info[eid] = {"bid": m.group(1) if m else None, "status": s(r.get("status")),
                        "paid": dec(r.get("amount_paid")) or 0}

fact_events = set()
for r in load_csv(CSV_DIR / "document (8).csv"):
    if (s(r.get("type")) or "").lower() in ("facture", "solde"):
        e = s(r.get("event_id"))
        if e:
            fact_events.add(e)

quotes = db.get_all("quotes", "id,external_id,total_ttc,status", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
items = db.get_all("quote_items", "quote_id,name,item_type", f"external_source=eq.{SOURCE}")
pbq = defaultdict(list)
for it in items:
    if it.get("item_type") != "extra":
        pbq[it["quote_id"]].append(it)
placeholders = [q for q in quotes
                if len(pbq.get(q["id"], [])) == 1 and "import Booking Shake" in (pbq[q["id"]][0].get("name") or "")]


def parse_devis(d):
    its, ok = p4.parse_lines(p4.pdftext(p4.download(d["url"])))
    txt = p4.pdftext(p4.download(d["url"]))
    return its, ok, pdf_total(txt)


def choose(devis):
    """Retourne (items, devis_total, version_name, raison_residuel|None)."""
    valides = [d for d in devis if d["valide"]]
    if valides:
        d = max(valides, key=lambda x: vnum(x["name"]))
        its, ok, tot = parse_devis(d)
        return (its, tot, d["name"], None) if ok and tot else (None, None, d["name"], "parse_valide_ko")
    # pas de Valide : comparer les totaux des versions
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


def evaluate(q):
    eid = q["external_id"]
    info = ev_info.get(eid)
    if not info:
        return {"q": q, "seg": "no_event"}
    if (info["status"] or "").startswith("Annul"):
        return {"q": q, "seg": "annule"}
    if eid in fact_events or info["paid"] > 0:
        return {"q": q, "seg": "facture_path"}
    devis = by_bid.get(info["bid"], [])
    if not devis:
        return {"q": q, "seg": "no_devis"}
    its, tot, ver, residual = choose(devis)
    if residual:
        return {"q": q, "seg": "residual", "reason": residual, "ver": ver}
    line_sum = round(sum((i["total_ttc"] or 0) for i in its), 2)
    if not tot or abs(line_sum - tot) > max(2.0, 0.02 * tot):
        return {"q": q, "seg": "residual", "reason": f"lignes!=devis({line_sum}/{tot})", "ver": ver}
    return {"q": q, "seg": "enrich", "items": its, "devis_total": tot, "ver": ver,
            "me_total": q["total_ttc"] or 0}


targets = placeholders[:limit] if limit else placeholders
with ThreadPoolExecutor(max_workers=10) as ex:
    res = list(ex.map(evaluate, targets))

seg = Counter(r["seg"] for r in res)
enrich = [r for r in res if r["seg"] == "enrich"]
residual = [r for r in res if r["seg"] == "residual"]
ca_old = sum(r["me_total"] for r in enrich)
ca_new = sum(r["devis_total"] for r in enrich)

section(f"ENRICHISSEMENT DEVIS-PDF  [{'APPLY' if apply else 'DRY-RUN'}]" + (f"  (limit {limit})" if limit else ""))
line("placeholders analyses", len(targets))
for k in ("enrich", "facture_path", "annule", "no_devis", "residual", "no_event"):
    line(f"  {k}", seg.get(k, 0))
line("lignes a inserer (enrich)", sum(len(r["items"]) for r in enrich))
line("CA forecast enrichi : ancien -> nouveau", f"{ca_old:,.0f} -> {ca_new:,.0f}  (delta {ca_new-ca_old:+,.0f})")
print("\n  -- echantillon enrichi (event : ME -> devis [delta], version, n lignes) --")
for r in sorted(enrich, key=lambda x: -abs(x["devis_total"] - x["me_total"]))[:10]:
    print(f"     {r['q']['external_id']:12} {r['me_total']:>9} -> {r['devis_total']:>9} "
          f"[{r['devis_total']-r['me_total']:+.0f}]  {r['ver'][:26]:26} {len(r['items'])}l")
if residual:
    print("\n  -- echantillon residuel (-> equipes) --")
    for r in residual[:8]:
        print(f"     {r['q']['external_id']:12} {r.get('reason','?')}")

# fichier residuel (G5)
BACKUP_DIR.mkdir(exist_ok=True)
with open(BACKUP_DIR / "g2_residual_devis.csv", "w", newline="", encoding="utf-8") as f:
    w = csvmod.writer(f)
    w.writerow(["event_id", "statut_ME", "total_ME", "raison", "version"])
    for r in residual:
        w.writerow([r["q"]["external_id"], r["q"]["status"], r["q"]["total_ttc"], r.get("reason"), r.get("ver")])
line(">> residuel devis (G5)", f"backups/g2_residual_devis.csv ({len(residual)} lignes)")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour enrichir, snapshot + DELETE-avant-insert.)")
    sys.exit(0)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
qids = [r["q"]["id"] for r in enrich]
snap = [it for it in db.get_all("quote_items", "id,quote_id,name,description,quantity,unit_price,total_ht,total_ttc,tva_rate,item_type,position,external_id", f"external_source=eq.{SOURCE}") if it["quote_id"] in set(qids)]
hdr = [{"id": r["q"]["id"], "total_ttc": r["me_total"]} for r in enrich]
(BACKUP_DIR / f"enrich_devis_snapshot_{ts}.json").write_text(json.dumps({"items": snap, "headers": hdr}, ensure_ascii=False, indent=1))
line("snapshot", f"enrich_devis_snapshot_{ts}.json")


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
line(">> devis enrichis", len(enrich))
line(">> lignes inserees", n)
line(">> snapshot", f"backups/enrich_devis_snapshot_{ts}.json")
