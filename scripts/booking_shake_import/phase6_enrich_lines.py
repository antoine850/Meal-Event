"""Phase 6 -- enrichit les devis BS : remplace la ligne placeholder par les vraies lignes
extraites des PDF (resultat de phase4, lu dans bs_enrich_dryrun.json).

Perimetre strict : seulement les events ou les lignes sont coherentes (HT*(1+TVA)==TTC) ET
ou somme(lignes) == total_ttc STOCKE du devis -> le total affiche ne bouge pas, zero impact CA.

Ordre sur : insert des vraies lignes (external_id = event_id:NN) PUIS delete du placeholder
(external_id = event_id). Header total_ht/tva realigne sur les lignes (total_ttc inchange).
Snapshot des quote_items avant toute ecriture -> rollback dispo.

Usage : python3 phase6_enrich_lines.py [--apply] [--limit=N]
"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from lib import load_env, Supa, ORG_ID, SOURCE, section, line, unit_price_ht

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
DRYRUN_JSON = Path("/var/folders/7y/db2f28t15nq48hq99phxjlbh0000gn/T/bs_enrich_dryrun.json")


def line_ok(it):
    ht, ttc, tva = it["total_ht"] or 0, it["total_ttc"] or 0, it["tva_rate"] or 0
    return abs(ht * (1 + tva / 100) - ttc) <= max(0.05, 0.01 * abs(ttc))


def reconc(r):
    t = r["event_total"]
    return t and r["sum_ttc"] is not None and abs(r["sum_ttc"] - t) <= max(2.0, 0.02 * t)


def main():
    apply = "--apply" in sys.argv
    limit = next((int(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--limit=")), None)
    R = json.loads(DRYRUN_JSON.read_text())
    parsed = {r["eid"]: r for r in R if r["parsed"] and r["items"]
              and all(line_ok(i) for i in r["items"]) and reconc(r)}

    url, key, _ = load_env()
    db = Supa(url, key)
    orgf = f"organization_id=eq.{ORG_ID}"
    quotes = {q["external_id"]: q for q in
              db.get_all("quotes", "id,external_id,total_ttc", f"external_source=eq.{SOURCE}&{orgf}")}

    # perimetre : lignes == total_ttc stocke (le total ne bougera pas)
    work = []
    for eid, r in parsed.items():
        q = quotes.get(eid)
        if not q:
            continue
        lines_ttc = round(sum((i["total_ttc"] or 0) for i in r["items"]), 2)
        if abs(lines_ttc - (q["total_ttc"] or 0)) <= 1.0:
            work.append((eid, q, r, lines_ttc))
    if limit:
        work = work[:limit]

    section("PHASE 6 -- ENRICHISSEMENT LIGNES DEVIS BS  [%s]" % ("APPLY" if apply else "DRY-RUN"))
    line("events parsables & coherents & reconcilies", len(parsed))
    line("dont lignes == total_ttc stocke (write set)", len(work))
    line(">> placeholders a remplacer", len(work))
    line(">> vraies lignes a inserer", sum(len(w[2]["items"]) for w in work))

    if not apply:
        # snapshot meme en dry-run, pour avoir le point de retour avant le 1er apply
        items = db.get_all("quote_items", "id,quote_id,name,description,quantity,unit_price,"
                           "total_ht,total_ttc,tva_rate,item_type,position,external_id",
                           f"external_source=eq.{SOURCE}")
        BACKUP_DIR.mkdir(exist_ok=True)
        snap = BACKUP_DIR / f"items_snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        snap.write_text(json.dumps(items, ensure_ascii=False, indent=1))
        line("snapshot quote_items ecrit", snap.name)
        print("\n(dry-run: aucune ecriture. --apply pour enrichir.)")
        return

    # snapshot avant ecriture
    items = db.get_all("quote_items", "id,quote_id,name,description,quantity,unit_price,"
                       "total_ht,total_ttc,tva_rate,item_type,position,external_id",
                       f"external_source=eq.{SOURCE}")
    BACKUP_DIR.mkdir(exist_ok=True)
    snap = BACKUP_DIR / f"items_snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    snap.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    line("snapshot quote_items ecrit", snap.name)

    def enrich(t):
        eid, q, r, lines_ttc = t
        rows = [{
            "quote_id": q["id"], "external_source": SOURCE, "external_id": f"{eid}:{pos}",
            "name": (it["name"] or "Prestation")[:255], "description": it["description"] or None,
            "quantity": it["quantity"], "unit_price": unit_price_ht(it),
            "total_ht": it["total_ht"], "total_ttc": it["total_ttc"],
            "tva_rate": it["tva_rate"], "item_type": "product", "position": pos,
        } for pos, it in enumerate(r["items"])]
        db._req("DELETE", f"/rest/v1/quote_items?external_source=eq.{SOURCE}"  # 1. purge lignes BS du devis
                f"&quote_id=eq.{q['id']}", extra={"Prefer": "return=minimal"})  #    (placeholder + anciennes :pos)
        db.upsert("quote_items", rows, "external_source,external_id")          # 2. insert des vraies lignes
        ht = round(sum((i["total_ht"] or 0) for i in r["items"]), 2)
        db.patch("quotes", f"id=eq.{q['id']}",                                 # 3. header cale sur lignes
                 {"total_ht": ht, "total_tva": round(lines_ttc - ht, 2), "total_ttc": lines_ttc})
        return len(rows), lines_ttc - (q["total_ttc"] or 0)

    with ThreadPoolExecutor(max_workers=4) as ex:
        res = list(ex.map(enrich, work))
    line(">> devis enrichis", len(work))
    line(">> lignes inserees", sum(x[0] for x in res))
    line("derive CA totale (lignes vs ancien total)", f"{round(sum(x[1] for x in res), 2)} EUR")


if __name__ == "__main__":
    main()
