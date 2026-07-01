"""G3/D -- pose deposit_amount_override = acompte BS exact sur les devis a acompte unique non ambigu.

Source = backups/g3_acompte_audit.csv (bucket a_corriger : acompte unique actif, sans override,
ME affiche 80%xtotal au lieu du vrai acompte). Garde dure : on n'ecrit QUE si le devis n'a pas
deja un override (jamais reecrire). Snapshot avant. Dry-run par defaut ; --apply pour ecrire."""
import sys, csv, json
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])

audit = list(csv.DictReader(open(BACKUP_DIR / "g3_acompte_audit.csv", encoding="utf-8")))
targets = [r for r in audit if r["bucket"] == "a_corriger"]

# etat DB frais des devis vises (garde : refuser si override deja pose)
eids = [r["event_id"] for r in targets]
quotes = {q["external_id"]: q for q in
          db.get_all("quotes", "id,external_id,total_ttc,deposit_percentage,deposit_amount_override",
                     f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}") if q.get("external_id")}

plan, skipped = [], []
for r in targets:
    q = quotes.get(r["event_id"])
    if not q:
        skipped.append((r["event_id"], "devis introuvable"))
        continue
    if q.get("deposit_amount_override") is not None:
        skipped.append((r["event_id"], "override deja pose -> on ne reecrit pas"))
        continue
    plan.append((q, float(r["bs_acompte"])))

section(f"G3/D APPLY ACOMPTE  [{'APPLY' if apply else 'DRY-RUN'}]")
line("cibles (a_corriger)", len(targets))
line(">> a poser (override absent)", len(plan))
line("   ecartes", len(skipped))
print("\n  echantillon (event : acompte BS a poser | ancien affiche 80%xtotal) :")
for q, acc in plan[:12]:
    old = round((q.get("total_ttc") or 0) * (q.get("deposit_percentage") or 0) / 100)
    print(f"    {q['external_id']:12} {acc:>8} EUR   (avant ~{old})")
for e, why in skipped:
    print(f"    SKIP {e:12} {why}")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour ecrire, snapshot inclus.)")
    sys.exit(0)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
(BACKUP_DIR / f"g3d_snapshot_{ts}.json").write_text(json.dumps(
    [{"id": q["id"], "external_id": q["external_id"], "deposit_amount_override": q.get("deposit_amount_override")}
     for q, _ in plan], ensure_ascii=False, indent=1))
for q, acc in plan:
    db.patch("quotes", f"id=eq.{q['id']}", {"deposit_amount_override": acc})
print(f"\n  >> overrides poses : {len(plan)}")
print(f"  >> snapshot : backups/g3d_snapshot_{ts}.json")
