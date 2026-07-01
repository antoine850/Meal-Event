"""G3/C -- corrige le total des facturés placeholder ENTIEREMENT facturés (facture complete).

Modele : total_ttc = commande = ce que BS a facture en entier (ap+aw), UNIQUEMENT quand la
facturation est complete et corroboree par les docs (facture, ou acompte+solde). On ne touche
JAMAIS un event partiellement facture (acompte seul), ni un enrichi (lignes=devis), ni un avoir.
Corrige header + la ligne placeholder ensemble (sinon recalculateQuoteTotals rebascule au 1er edit).
Snapshot avant. Dry-run par defaut ; --apply pour ecrire."""
import sys, json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, EVENTS_CSV, BILLING_CSV, load_csv, s, dec, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])


def cl(a, b, p=0.02):
    return b > 0 and abs(a - b) <= max(5, p * b)


ev = {}
for r in load_csv(EVENTS_CSV):
    e = s(r.get("event_id"))
    if e:
        ev[e] = (dec(r.get("amount_paid")) or 0) + (dec(r.get("amount_waiting")) or 0)

# doc8 actifs : par event/type -> (ttc, ht) du plus gros doc
bi = load_csv(BILLING_CSV)
d8 = defaultdict(lambda: {"facture": (0, 0), "acompte": (0, 0), "solde": (0, 0)})
has_bill, avoir = set(), set()
for r in bi:
    e = s(r.get("event_id")); t = (r.get("type") or "").strip()
    if not e:
        continue
    if "avoir" in t:
        avoir.add(e); continue
    if (r.get("invoice_status") or "") == "Annulé":
        continue
    if t in ("facture", "acompte", "solde"):
        ttc = dec(r.get("amountTTC")) or 0
        if ttc > d8[e][t][0]:
            d8[e][t] = (ttc, dec(r.get("amountHT")) or 0)
        has_bill.add(e)

bk = db.get_all("bookings", "external_id,status_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
stn = {r["id"]: r["name"] for r in db.get_all("statuses", "id,name")}
evst = {b["external_id"]: stn.get(b["status_id"], "?") for b in bk if b.get("external_id")}
quotes = db.get_all("quotes", "id,external_id,total_ttc,total_ht,total_tva",
                    f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
items = db.get_all("quote_items", "id,quote_id,name,item_type,tva_rate",
                   f"external_source=eq.{SOURCE}")
byq = defaultdict(list)
for it in items:
    byq[it["quote_id"]].append(it)

plan, dropped_partial = [], 0
for q in quotes:
    e = q.get("external_id")
    if e not in has_bill or e in avoir or "Annul" in evst.get(e, ""):
        continue
    prod = [i for i in byq.get(q["id"], []) if i.get("item_type") != "extra"]
    if not (len(prod) == 1 and "import Booking Shake" in (prod[0].get("name") or "")):
        continue  # enrichi (lignes=devis) -> on laisse
    binv = ev.get(e, 0); mt = q.get("total_ttc") or 0
    if binv <= 0 or abs(mt - binv) <= max(2, 0.02 * binv):
        continue  # deja bon
    f, a, so = d8[e]["facture"], d8[e]["acompte"], d8[e]["solde"]
    if f[0] and cl(binv, f[0]):
        dttc, dht = f
    elif a[0] and so[0] and cl(binv, a[0] + so[0]):
        dttc, dht = a[0] + so[0], a[1] + so[1]
    else:
        dropped_partial += 1  # pas de facture complete corroboree -> partiel -> devis/equipes
        continue
    new_ht = round(binv * dht / dttc, 2) if dttc else round(binv / 1.1, 2)
    plan.append({"q": q, "line": prod[0], "new_ttc": round(binv, 2), "new_ht": new_ht,
                 "new_tva": round(binv - new_ht, 2), "old_ttc": round(mt, 2)})

section(f"G3/C FIX TOTAUX FACTURES (facture complete)  [{'APPLY' if apply else 'DRY-RUN'}]")
line("placeholder facturés au total faux", len(plan) + dropped_partial)
line(">> a corriger (facture complete corroboree)", len(plan))
line("   ecartes (acompte seul / non corrobore -> devis/equipes)", dropped_partial)
print("\n  echantillon (event : ancien total -> nouveau (=ap+aw) | HT | TVA) :")
for p in sorted(plan, key=lambda x: -abs(x["new_ttc"] - x["old_ttc"]))[:14]:
    print(f"    {p['q']['external_id']:12} {p['old_ttc']:>9} -> {p['new_ttc']:>9}  ht={p['new_ht']:>9} tva={p['new_tva']:>8}")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour ecrire, snapshot inclus.)")
    sys.exit(0)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
snap = [{"quote_id": p["q"]["id"], "external_id": p["q"]["external_id"],
         "quote_total_ht": p["q"].get("total_ht"), "quote_total_tva": p["q"].get("total_tva"),
         "quote_total_ttc": p["q"].get("total_ttc"), "line_id": p["line"]["id"],
         "line_tva_rate": p["line"].get("tva_rate")} for p in plan]
(BACKUP_DIR / f"g3c_snapshot_{ts}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))

for p in plan:
    tva = round((p["new_ttc"] / p["new_ht"] - 1) * 100, 2) if p["new_ht"] else 10
    db.patch("quote_items", f"id=eq.{p['line']['id']}",
             {"quantity": 1, "unit_price": p["new_ht"], "total_ht": p["new_ht"],
              "total_ttc": p["new_ttc"], "tva_rate": tva})
    db.patch("quotes", f"id=eq.{p['q']['id']}",
             {"total_ht": p["new_ht"], "total_tva": p["new_tva"], "total_ttc": p["new_ttc"]})
print(f"\n  >> devis corriges : {len(plan)}")
print(f"  >> snapshot : backups/g3c_snapshot_{ts}.json")
