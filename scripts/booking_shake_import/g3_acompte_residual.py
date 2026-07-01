"""G3/D residuel -- events multi-acompte VRAIMENT ambigus (le fichier equipes ne les avait pas).

Un event avec >=2 docs acompte actifs distincts est ambigu SAUF si un seul colle a l'acompte
attendu (deposit_amount_override, sinon deposit_percentage x total). Ceux qui collent = tranches
par la regle "plus gros acompte actif" (deja appliquee). Ceux qui ne collent pas -> equipes.
Lecture seule. Ecrit backups/g3_acompte_residual.csv."""
import sys, csv as csvmod
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, BILLING_CSV, load_csv, s, dec, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
db = Supa(*load_env()[:2])

acc_docs = defaultdict(list)
for r in load_csv(BILLING_CSV):
    e = s(r.get("event_id")); t = (r.get("type") or "").strip()
    if not e or t != "acompte":
        continue
    if (r.get("invoice_status") or "") == "Annulé":
        continue
    a = dec(r.get("amountTTC")) or 0
    if a > 0:
        acc_docs[e].append(a)

quotes = db.get_all("quotes", "id,external_id,total_ttc,deposit_percentage,deposit_amount_override,status",
                    f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
q_by_e = {q["external_id"]: q for q in quotes if q.get("external_id")}

resid = []
for e, docs in acc_docs.items():
    acs = sorted(set(round(a, 2) for a in docs), reverse=True)
    if len(acs) < 2:
        continue
    q = q_by_e.get(e)
    if not q:
        continue
    tot = q.get("total_ttc") or 0
    exp = float(q["deposit_amount_override"]) if q.get("deposit_amount_override") else \
        (float(q["deposit_percentage"]) / 100 * tot if q.get("deposit_percentage") and tot else None)
    matches = [a for a in acs if exp and abs(a - exp) <= max(5, 0.03 * exp)]
    if len(matches) == 1:
        continue  # departageable -> deja gere par la regle plus-gros-acompte
    resid.append({"event_id": e, "statut_ME": q.get("status"), "total_ME": round(tot, 2),
                  "acomptes_actifs": " / ".join(f"{a:.0f}" for a in acs),
                  "acompte_attendu": round(exp) if exp else "", "raison": "plusieurs acomptes actifs, aucun ne tranche"})

section("G3/D residuel acompte ambigu")
line("events multi-acompte actif", sum(1 for e, d in acc_docs.items() if len(set(round(a, 2) for a in d)) >= 2))
line(">> ambigus non tranchables (G5)", f"backups/g3_acompte_residual.csv ({len(resid)})")
BACKUP_DIR.mkdir(exist_ok=True)
with open(BACKUP_DIR / "g3_acompte_residual.csv", "w", newline="", encoding="utf-8") as f:
    w = csvmod.DictWriter(f, fieldnames=["event_id", "statut_ME", "total_ME", "acomptes_actifs", "acompte_attendu", "raison"])
    w.writeheader(); w.writerows(sorted(resid, key=lambda r: r["event_id"]))
for r in resid[:10]:
    print(f"     {r['event_id']:12} acomptes={r['acomptes_actifs']:24} attendu={r['acompte_attendu']}  total={r['total_ME']}")
