"""Corrige unit_price des lignes BS enrichies : stocke en TTC par l'enrichissement (PU du PDF)
alors que roundLineTtc le traite comme du HT -> double TVA a la re-edition (+1,3M sur 1325 devis).
Fix : unit_price = total_ht / quantite (on s'appuie sur total_ht, fiable, jamais sur le PU du PDF).
Header quotes.total_ttc INTACT (montant facture/paye). Ne touche que quote_items.unit_price.

Dry-run par defaut (lecture seule, rapport + validation par devis) ; --apply pour ecrire (snapshot avant).
Idempotent : re-run repose unit_price = total_ht/qte, valeur identique."""
import sys, json, math
from datetime import datetime
from pathlib import Path
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
from lib import load_env, Supa, ORG_ID, SOURCE, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])


def n(x):
    return x if x is not None else 0


def r2(x):
    # arrondi au centime "half away from zero", comme le type numeric Postgres (prix >= 0 ici).
    return math.floor(x * 100 + 0.5) / 100


def is_placeholder(it):
    return "import Booking Shake" in (it.get("name") or "")


def round_line_ttc(qty, price, tva):
    return math.ceil(qty * price * (1 + tva / 100))


items = db.get_all("quote_items",
                   "id,quote_id,name,quantity,unit_price,total_ht,total_ttc,tva_rate,item_type",
                   f"external_source=eq.{SOURCE}")
quotes = {q["id"]: q for q in db.get_all(
    "quotes", "id,external_id,total_ttc,status,discount_percentage",
    f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")}

changes = []        # (it, new_up, source)  source = 'ht' | 'ttc_fallback'
noop = 0            # deja en HT (rien a changer)
skip_qty0 = []      # quantite nulle -> on ne divise pas
skip_noht = []      # ni total_ht ni total_ttc exploitables

for it in items:
    if it.get("item_type") == "extra" or is_placeholder(it):
        continue
    qty = n(it["quantity"])
    if qty <= 0:
        skip_qty0.append(it)
        continue
    # total_ht=0 est une VRAIE valeur (ligne offerte/incluse -> unit_price 0), pas une donnee manquante.
    # unit_price est stocke au centime (numeric 2 decimales) -> on arrondit a 2 pour comparer/ecrire juste.
    if it["total_ht"] is not None:
        new_up, src = r2(n(it["total_ht"]) / qty), "ht"
    elif n(it["total_ttc"]):
        new_up, src = r2(n(it["total_ttc"]) / (1 + n(it["tva_rate"]) / 100) / qty), "ttc_fallback"
    else:
        skip_noht.append(it)
        continue
    if abs(new_up - n(it["unit_price"])) < 0.005:
        noop += 1
    else:
        changes.append((it, new_up, src))

# Validation par devis : total recompose (lignes repricees, ceil par ligne) vs header stocke.
new_up_by_id = {it["id"]: up for it, up, _ in changes}
prod_by_q = defaultdict(list)
for it in items:
    if it.get("item_type") != "extra" and not is_placeholder(it):
        prod_by_q[it["quote_id"]].append(it)

buckets = Counter()
worst = []
for qid, prods in prod_by_q.items():
    q = quotes.get(qid)
    if not q:
        continue
    total = sum(round_line_ttc(n(it["quantity"]), new_up_by_id.get(it["id"], n(it["unit_price"])),
                               n(it["tva_rate"])) for it in prods)
    res = total - n(q["total_ttc"])
    a = abs(res)
    buckets["exact (<=0.5)" if a <= 0.5 else "<=1" if a <= 1.5 else "<=5" if a <= 5.5 else ">5"] += 1
    if a > 5.5:
        worst.append((q["external_id"], q["status"], n(q["total_ttc"]), total, round(res, 2), len(prods)))

section(f"REPRICE unit_price -> HT  [{'APPLY' if apply else 'DRY-RUN'}]")
line("lignes BS enrichies a repricer", len(changes))
line("  dont via total_ht", sum(1 for _, _, s in changes if s == "ht"))
line("  dont via fallback total_ttc/(1+tva) (total_ht absent)", sum(1 for _, _, s in changes if s == "ttc_fallback"))
line("lignes deja en HT (no-op)", noop)
zero_lines = [(it, up) for it, up, _ in changes if abs(up) < 1e-9 and abs(n(it["unit_price"])) > 1e-9]
line("  dont ramenees a 0 (total_ht=0, frais offert/inclus)", len(zero_lines))
line("lignes ignorees quantite nulle", len(skip_qty0))
line("lignes ignorees sans total_ht ni total_ttc", len(skip_noht))
line("devis enrichis concernes", len(prod_by_q))
line("header quotes.total_ttc", "INTACT (non modifie)")

section("VALIDATION : total recompose (apres reprice) vs total stocke, par devis")
for k in ("exact (<=0.5)", "<=1", "<=5", ">5"):
    line(k + " EUR", buckets[k])
print("  (le residu = arrondi ceil-par-ligne existant, chantier refactor separe)")
if worst:
    print("\n  -- devis a ecart > 5 EUR apres reprice (a verifier) --")
    for w in sorted(worst, key=lambda x: -abs(x[4]))[:15]:
        print(f"     {w[0]:12} {w[1]:14} stocke {w[2]:>9} -> recompose {w[3]:>9} [{w[4]:+}]  {w[5]} lignes")

print("\n  -- echantillon avant/apres (5 lignes) --")
for it, up, src in changes[:5]:
    print(f"     {(it['name'] or '')[:32]:32} qte={n(it['quantity']):>3}  PU {n(it['unit_price']):>8} -> {round(up, 4):>8}  ({src})")

if not apply:
    out = Path(BACKUP_DIR.parent) / "reprice_dryrun.json"
    print(f"\n(dry-run: aucune ecriture. {len(changes)} lignes seraient modifiees. --apply pour ecrire, snapshot inclus.)")
    sys.exit(0)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
snap = [{"id": it["id"], "quote_id": it["quote_id"], "unit_price": it["unit_price"],
         "total_ht": it["total_ht"], "total_ttc": it["total_ttc"], "tva_rate": it["tva_rate"]}
        for it, _, _ in changes]
(BACKUP_DIR / f"reprice_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))
line("snapshot ecrit", f"reprice_snapshot_{ts}.json ({len(snap)} lignes)")


def patch(t):
    it, up, _ = t
    db.patch("quote_items", f"id=eq.{it['id']}", {"unit_price": up})
    return 1


with ThreadPoolExecutor(max_workers=6) as ex:
    done = sum(ex.map(patch, changes))
line(">> lignes repricees", done)
line(">> snapshot", f"backups/reprice_snapshot_{ts}.json")
