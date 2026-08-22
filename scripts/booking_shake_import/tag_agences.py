"""Tague en category='agence' les societes dont le nom est celui d'une agence agissant pour un client.

Contexte 20/08 : les agences (Rejolt, Business Profilers, Amex GBT, Naboo...) n'existent pas
comme entite ; elles sont dans le nom des societes ("Business Profilers pour le compte de TOTAL
ENERGIE"). 72 societes sur 6919 portent un des deux motifs retenus.
Motifs ecartes, tous les deux parce qu'ils designent le CLIENT et pas l'agence :
  - " via " (35 cas) : le nom commence par le client ("EDF VIA KACTUS", "SAINT GOBAIN VIA
    KACTUS"). 32 des 35 sont "via kactus", qui est un canal d'acquisition (cf. lib.py, il
    alimente contacts.source), pas une agence. Tagger aurait catalogue EDF, Nestle ou KPMG
    en agences.
  - " pour " seul et "au nom" seul : reservations nominatives ("Marsh SAS - reservation
    au nom de Mde X", "Reservation au nom de M. Salih HAMDI") et consignes de facturation
    ("WINNCARE mais toute facturation doit se faire au nom de WINNINVEST"). D'ou la
    formule complete "au nom et pour", qui garde au passage "NABOO au nom et pour el
    compte de Axa Partners" (faute de frappe sur "le compte").
Ne touche jamais une societe dont la categorie est deja renseignee : re-lancable tel quel
apres un echec, sans effet apres un succes.
Dry-run par defaut ; --apply ecrit un snapshot puis PATCH une par une.
"""
import sys, json
from collections import Counter
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, section, line

MOTIFS = ("pour le compte", "au nom et pour")
CATEGORY = "agence"

apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])

companies = db.get_all("companies", "id,name,category", f"organization_id=eq.{ORG_ID}")
matched = [
    (c, tuple(m for m in MOTIFS if m in (c["name"] or "").lower()))
    for c in companies
]
matched = [(c, motifs) for c, motifs in matched if motifs]
plan = [(c, motifs) for c, motifs in matched if not c.get("category")]

section(f"TAG AGENCES  [{'APPLY' if apply else 'DRY-RUN'}]")
line("societes total", len(companies))
line("correspondances", len(matched))
line("   ecartees (deja categorisees)", len(matched) - len(plan))
line(">> a taguer 'agence'", len(plan))
line("   par motif", dict(Counter(m for _, motifs in plan for m in motifs)))
print()
for c, motifs in plan:
    print(f"    [{'+'.join(motifs)}] {c['name']}")

if not apply:
    print("\n(dry-run: aucune ecriture. Relancer avec --apply pour ecrire.)")
    sys.exit(0)

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
snap = BACKUP_DIR / f"tag_agences_snapshot_{ts}.json"
snap.write_text(json.dumps(
    [{"id": c["id"], "name": c["name"], "category": c.get("category")} for c, _ in plan],
    ensure_ascii=False, indent=1))
print(f"\n  >> snapshot : backups/{snap.name}")
# Une ligne par societe : un echec en cours de route laisse voir ou ca s'est arrete.
for i, (c, _) in enumerate(plan, 1):
    db.patch("companies", f"id=eq.{c['id']}", {"category": CATEGORY})
    print(f"    {i:>3}/{len(plan)} {c['name'][:60]}")
print(f"  >> tagues : {len(plan)}")
