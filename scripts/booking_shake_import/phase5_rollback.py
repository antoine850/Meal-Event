"""Rollback de la correction des totaux (phase5). Relit un snapshot et restaure les
total_ht/tva/ttc d'origine, PATCH par id.

Garde-fou anti-ecrasement : un devis n'est restaure que s'il est reste tel que la correction
l'a laisse (current total_ttc == somme de ses lignes). Si quelqu'un l'a edite depuis, current
diverge des lignes -> on SKIP et on signale, jamais on n'ecrase un travail manuel.

Usage : python3 phase5_rollback.py [snapshot.json] [--apply]
Sans argument de fichier : prend le plus ancien snapshot de backups/ (l'etat pre-correction).
"""
import json, sys
from pathlib import Path
from lib import load_env, Supa, ORG_ID, SOURCE, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"


def main():
    apply = "--apply" in sys.argv
    files = [a for a in sys.argv[1:] if a.endswith(".json")]
    snap_path = Path(files[0]) if files else sorted(BACKUP_DIR.glob("quotes_snapshot_*.json"))[0]
    snap = {q["id"]: q for q in json.loads(snap_path.read_text())}

    url, key, _ = load_env()
    db = Supa(url, key)
    orgf = f"organization_id=eq.{ORG_ID}"
    cur = {q["id"]: q for q in db.get_all("quotes", "id,total_ttc", f"external_source=eq.{SOURCE}&{orgf}")}
    items = db.get_all("quote_items", "quote_id,total_ttc,item_type", f"external_source=eq.{SOURCE}")
    isum = {}
    for it in items:
        if it.get("item_type") != "extra":
            isum[it["quote_id"]] = round(isum.get(it["quote_id"], 0) + (it["total_ttc"] or 0), 2)

    restore, noop, edited = [], 0, []
    for qid, s in snap.items():
        c = cur.get(qid)
        if not c:
            continue
        if abs((c["total_ttc"] or 0) - (s["total_ttc"] or 0)) <= 1.0:
            noop += 1  # deja a l'etat snapshot
            continue
        # untouched depuis la correction = current == somme des lignes
        if abs((c["total_ttc"] or 0) - isum.get(qid, c["total_ttc"] or 0)) <= 1.0:
            restore.append(s)
        else:
            edited.append((s["external_id"], c["total_ttc"], isum.get(qid)))

    section("ROLLBACK TOTAUX DEVIS BS  [%s]" % ("APPLY" if apply else "DRY-RUN"))
    line("snapshot", snap_path.name)
    line("devis a restaurer (-> valeur d'origine)", len(restore))
    line("deja a l'etat snapshot (no-op)", noop)
    line("edites manuellement depuis -> SKIP", len(edited))
    for e in edited[:8]:
        print(f"    SKIP {e[0]:14} current={e[1]} lignes={e[2]}")

    if not apply:
        print("\n(dry-run: aucune ecriture. --apply pour restaurer.)")
        return
    for s in restore:
        db.patch("quotes", f"id=eq.{s['id']}",
                 {"total_ht": s["total_ht"], "total_tva": s["total_tva"], "total_ttc": s["total_ttc"]})
    line(">> devis restaures", len(restore))


if __name__ == "__main__":
    main()
