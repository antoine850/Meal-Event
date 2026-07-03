"""Backfill unit_price_ttc = total_ttc / quantite (4 decimales) sur les lignes d'avant la
migration 20260701 (unit_price_ttc NULL). Ne touche AUCUN total : on remplit seulement
l'ancre TTC pour que l'affichage soit coherent et que les re-editions ne re-derivent plus
depuis le HT arrondi (les 1999,80 au lieu de 2000).

Garde-fou : on n'ecrit que si round2(qty * pu4) == total_ttc, avec round2 identique au
TypeScript (Math.round((abs+1e-9)*100), float IEEE-754) -> le verbatim de computeLineAmounts
reproduira exactement le total stocke. Lignes remisees exclues (le PU stocke serait faux).

Toujours snapshot AVANT d'ecrire (backups/unit_price_ttc_snapshot_<ts>.json) -> rollback =
remettre unit_price_ttc a NULL sur les ids du snapshot. Dry-run par defaut. --apply pour
ecrire. --limit N pour un canari.
"""
import json, math, sys
from datetime import datetime
from pathlib import Path
from lib import load_env, Supa, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"


def round2(n):
    # Copie de round2 TS : arrondi demi-superieur au centime, epsilon anti-bruit flottant.
    sign = -1 if n < 0 else 1
    return sign * math.floor((abs(n) + 1e-9) * 100 + 0.5) / 100


def main():
    apply = "--apply" in sys.argv
    limit = next((int(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--limit=")), None)
    url, key, _ = load_env()
    db = Supa(url, key)

    items = db.get_all(
        "quote_items",
        "id,quote_id,name,quantity,unit_price,unit_price_ttc,price_entry_mode,tva_rate,discount_amount,total_ht,total_ttc,item_type",
        "unit_price_ttc=is.null",
    )

    fills, skip_discount, skip_no_total, skip_roundtrip = [], [], [], []
    for it in items:
        qty, ttc = it["quantity"] or 0, it["total_ttc"]
        if it["discount_amount"]:
            skip_discount.append(it); continue
        if ttc is None or qty <= 0:
            skip_no_total.append(it); continue
        pu4 = round(ttc / qty, 4)
        if round2(qty * pu4) != round2(ttc):
            skip_roundtrip.append(it); continue
        fills.append({"id": it["id"], "unit_price_ttc": pu4, "_item": it})
    if limit:
        fills = fills[:limit]

    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    snap = BACKUP_DIR / f"unit_price_ttc_snapshot_{ts}.json"
    snap.write_text(json.dumps([f["_item"] for f in fills], ensure_ascii=False, indent=1))

    section("BACKFILL unit_price_ttc  [%s]" % ("APPLY" if apply else "DRY-RUN"))
    line("snapshot ecrit", snap)
    line("lignes unit_price_ttc NULL", len(items))
    line("a remplir (total / qte, round-trip OK)", len(fills))
    line("exclues : remise ligne", len(skip_discount))
    line("exclues : total absent ou qte nulle", len(skip_no_total))
    line("exclues : round-trip KO (total non reproductible)", len(skip_roundtrip))
    print("\n  echantillon (nom : qte x pu4 -> total stocke) :")
    for f in fills[:8]:
        it = f["_item"]
        print(f"    {(it['name'] or '?')[:38]:40} {it['quantity']:>4} x {f['unit_price_ttc']:>10} -> {it['total_ttc']:>10}")
    if skip_roundtrip:
        print("\n  round-trip KO (a auditer, non touchees) :")
        for it in skip_roundtrip[:8]:
            print(f"    {(it['name'] or '?')[:38]:40} qte {it['quantity']} total {it['total_ttc']}")

    if not apply:
        print("\n(dry-run: aucune ecriture. --apply pour remplir.)")
        return

    # PATCH groupe par valeur (l'upsert partiel echoue sur les NOT NULL avant le ON CONFLICT).
    # Idempotent : le filtre unit_price_ttc=is.null permet de relancer apres interruption.
    by_val = {}
    for f in fills:
        by_val.setdefault(f["unit_price_ttc"], []).append(f["id"])
    done = 0
    for val, ids in by_val.items():
        for i in range(0, len(ids), 150):
            chunk = ids[i:i + 150]
            db.patch("quote_items",
                     "unit_price_ttc=is.null&id=in.(" + ",".join(chunk) + ")",
                     {"unit_price_ttc": val})
            done += len(chunk)
    line(">> lignes remplies", done)


if __name__ == "__main__":
    main()
