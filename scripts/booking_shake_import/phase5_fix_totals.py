"""Phase 5 -- corrige les total_ht/tva/ttc des devis BS dont le header ne colle plus a ses
lignes (bug d'import : header = somme de tous les docs, gonfle x2-x3). La valeur correcte =
somme des lignes du devis, exactement ce que l'app recalcule a l'edition (recalculateQuoteTotals).

Toujours snapshot AVANT d'ecrire (backups/quotes_snapshot_<ts>.json) -> rollback possible.
Dry-run par defaut. --apply pour ecrire. --limit N pour un canari.
"""
import json, sys
from datetime import datetime
from pathlib import Path
from lib import load_env, Supa, ORG_ID, SOURCE, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"


def main():
    apply = "--apply" in sys.argv
    limit = next((int(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--limit=")), None)
    url, key, _ = load_env()
    db = Supa(url, key)
    orgf = f"organization_id=eq.{ORG_ID}"

    quotes = db.get_all("quotes", "id,external_id,total_ht,total_tva,total_ttc,updated_at",
                        f"external_source=eq.{SOURCE}&{orgf}")
    items = db.get_all("quote_items", "quote_id,total_ht,total_ttc,item_type",
                       f"external_source=eq.{SOURCE}")
    sums = {}
    for it in items:
        if it.get("item_type") == "extra":
            continue
        s = sums.setdefault(it["quote_id"], {"ht": 0.0, "ttc": 0.0})
        s["ht"] += it["total_ht"] or 0
        s["ttc"] += it["total_ttc"] or 0

    # snapshot complet de l'etat actuel (toujours, meme en dry-run)
    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    snap = BACKUP_DIR / f"quotes_snapshot_{ts}.json"
    snap.write_text(json.dumps(quotes, ensure_ascii=False, indent=1))

    fixes = []
    for q in quotes:
        s = sums.get(q["id"])
        if not s:
            continue
        ht, ttc = round(s["ht"], 2), round(s["ttc"], 2)
        if abs(ttc - (q["total_ttc"] or 0)) <= 1.0:
            continue  # deja coherent
        fixes.append({
            "id": q["id"], "external_id": q["external_id"],
            "total_ht": ht, "total_tva": round(ttc - ht, 2), "total_ttc": ttc,
            "_old_ttc": q["total_ttc"] or 0,
        })
    if limit:
        fixes = fixes[:limit]

    ca_before = round(sum(q["total_ttc"] or 0 for q in quotes))
    ca_delta = round(sum(f["_old_ttc"] - f["total_ttc"] for f in fixes))
    section("PHASE 5 -- CORRECTION TOTAUX DEVIS BS  [%s]" % ("APPLY" if apply else "DRY-RUN"))
    line("snapshot ecrit", snap)
    line("devis BS total", len(quotes))
    line("devis a corriger (header != lignes)", len(fixes))
    line("CA BS actuel (somme total_ttc)", f"{ca_before} EUR")
    line("CA retire par la correction", f"-{ca_delta} EUR")
    line("CA BS apres correction", f"{ca_before - ca_delta} EUR")
    print("\n  echantillon (external_id : ancien -> nouveau TTC) :")
    for f in fixes[:8]:
        print(f"    {f['external_id']:14} {f['_old_ttc']:>10} -> {f['total_ttc']:>10}")

    if not apply:
        print("\n(dry-run: aucune ecriture. Snapshot deja fait. --apply pour corriger.)")
        return

    for f in fixes:
        db.patch("quotes", f"id=eq.{f['id']}",
                 {"total_ht": f["total_ht"], "total_tva": f["total_tva"], "total_ttc": f["total_ttc"]})
    line(">> devis corriges", len(fixes))


if __name__ == "__main__":
    main()
