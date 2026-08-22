"""Tague en category='agence' les societes dont le nom porte l'agence ET le client final.

Contexte 20/08 : les agences (Rejolt, Business Profilers, Naboo...) n'existent pas comme
entite ; elles sont dans le nom des societes ("Business Profilers pour le compte de TOTAL
ENERGIE", "CARGLASS VIA REJOLT"). 110 societes sur 6919 portent un de ces motifs.
Le motif " pour " seul est volontairement exclu : trop de faux positifs (reservations
nominatives type "Marsh SAS - reservation au nom de Mde X" est deja couvert par "au nom").
Ne touche jamais une societe dont la categorie est deja renseignee.
Dry-run par defaut ; --apply ecrit un snapshot puis PATCH une par une.
"""
import sys, json
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, section, line

MOTIFS = ("pour le compte", "au nom", " via ")
CATEGORY = "agence"

apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])

companies = db.get_all("companies", "id,name,category", f"organization_id=eq.{ORG_ID}")
plan = [
    c for c in companies
    if not c.get("category") and any(m in (c["name"] or "").lower() for m in MOTIFS)
]

section(f"TAG AGENCES  [{'APPLY' if apply else 'DRY-RUN'}]")
line("societes total", len(companies))
line("deja categorisees", sum(1 for c in companies if c.get("category")))
line(">> a taguer 'agence'", len(plan))
print("\n  echantillon :")
for c in plan[:15]:
    print(f"    {c['name'][:70]}")

if not apply:
    print("\n(dry-run: aucune ecriture. Relancer avec --apply pour ecrire.)")
    sys.exit(0)

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
snap = BACKUP_DIR / f"tag_agences_snapshot_{ts}.json"
snap.write_text(json.dumps(
    [{"id": c["id"], "name": c["name"], "category": c.get("category")} for c in plan],
    ensure_ascii=False, indent=1))
print(f"\n  >> snapshot : backups/{snap.name}")
for c in plan:
    db.patch("companies", f"id=eq.{c['id']}", {"category": CATEGORY})
print(f"  >> tagues : {len(plan)}")
