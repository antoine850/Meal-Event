"""Evaluation (LECTURE SEULE, aucune ecriture) du modele "documents vivants".
Par event BS : recalcule le vrai total a partir des seuls docs Paye/En cours (annules + avoirs
ecartes), valide la regle sur les events sans annulation, et liste les totaux a corriger.
Sort un JSON worklist dans backups/. NE TOUCHE PAS la base."""
import sys, json
from collections import defaultdict, Counter
from datetime import datetime
from pathlib import Path
import urllib.request
sys.path.insert(0, ".")
from lib import load_env, load_csv, BILLING_CSV, ORG_ID, SOURCE, s, dec

url, key, _ = load_env(); H = {"apikey": key, "Authorization": f"Bearer {key}"}
def get_all(table, select, q=""):
    out, off, page = [], 0, 1000
    while True:
        u = f"{url}/rest/v1/{table}?select={select}&limit={page}&offset={off}&order=id{('&'+q) if q else ''}"
        with urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=120) as r:
            c = json.loads(r.read().decode())
        out += c; off += page
        if len(c) < page: return out

def dtype(d): return (s(d.get("type")) or "facture").lower()
def is_live(d): return (s(d.get("invoice_status")) or "").lower() in ("payé", "paye", "en cours")
AVOIR = {"acompte-avoir", "solde-avoir", "facture-avoir"}

bi = load_csv(BILLING_CSV)
bill = defaultdict(list)
for r in bi:
    e = s(r.get("event_id"))
    if e: bill[e].append(r)

# DB : devis BS (total stocke, statut) + placeholder ?
quotes = get_all("quotes", "id,external_id,total_ttc,status", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
qmap = {q["external_id"]: q for q in quotes if q.get("external_id")}
items = get_all("quote_items", "quote_id,name,item_type", f"external_source=eq.{SOURCE}")
by_q = defaultdict(list)
for it in items: by_q[it["quote_id"]].append(it)
def is_placeholder(qid):
    prod = [i for i in by_q.get(qid, []) if i.get("item_type") != "extra"]
    return len(prod) == 1 and "import Booking Shake" in (prod[0].get("name") or "")

def live_total(docs):
    live = [d for d in docs if is_live(d) and dtype(d) not in AVOIR]
    aco = round(sum(dec(d.get("amountTTC")) or 0 for d in live if dtype(d) == "acompte"), 2)
    sol = round(sum(dec(d.get("amountTTC")) or 0 for d in live if dtype(d) == "solde"), 2)
    fac = round(sum(dec(d.get("amountTTC")) or 0 for d in live if dtype(d) == "facture"), 2)
    # eviter le double comptage facture vs acompte+solde : solde -> chemin acompte+solde ; sinon facture ; sinon acompte
    if sol > 0:
        return round(aco + sol, 2), "acompte+solde", aco, sol, fac
    if fac > 0:
        return fac, "facture", aco, sol, fac
    return aco, "acompte_seul", aco, sol, fac

rows = []
for eid, q in qmap.items():
    docs = bill.get(eid, [])
    lt, path, aco, sol, fac = live_total(docs)
    cancelled = round(sum(dec(d.get("amountTTC")) or 0 for d in docs
                          if (s(d.get("invoice_status")) or "").lower() == "annulé"), 2)
    has_avoir = any(dtype(d) in AVOIR for d in docs)
    stored = q.get("total_ttc") or 0
    has_live_detail = any(dtype(d) in ("facture", "solde") and is_live(d) and s(d.get("url")) for d in docs)
    rows.append({
        "eid": eid, "stored": stored, "live_total": lt, "path": path,
        "delta": round(lt - stored, 2), "cancelled_amount": cancelled, "has_avoir": has_avoir,
        "revised": cancelled != 0 or has_avoir, "status": q.get("status"),
        "placeholder": is_placeholder(q["id"]), "detail_recuperable": has_live_detail,
        "no_billing_doc": not docs,
    })

def near(a, b): return b and abs(a - b) <= max(2.0, 0.02 * abs(b))

clean = [r for r in rows if not r["revised"] and not r["no_billing_doc"]]
revised = [r for r in rows if r["revised"]]
clean_match = sum(1 for r in clean if near(r["live_total"], r["stored"]))
correctable = [r for r in rows if r["live_total"] and not near(r["live_total"], r["stored"]) and not r["no_billing_doc"]]

print("=== EVALUATION 'DOCUMENTS VIVANTS' (LECTURE SEULE) ===")
print(f"  devis BS analyses           : {len(rows)}")
print(f"  sans aucun doc de facturation: {sum(1 for r in rows if r['no_billing_doc'])}")
print(f"\n  VALIDATION DE LA REGLE (events SANS annulation) :")
print(f"    {clean_match}/{len(clean)} ({100*clean_match/max(1,len(clean)):.0f}%) ou live_total == total stocke")
print(f"    -> si ~100%, la regle est saine et les ecarts ci-dessous sont de vraies corrections")
print(f"\n  events REVISES (Annule/avoir present): {len(revised)}")
print(f"\n  >> TOTAUX A CORRIGER (stored != live_total a 2%): {len(correctable)}")
up = [r for r in correctable if r["delta"] > 0]; dn = [r for r in correctable if r["delta"] < 0]
print(f"     dont total stocke TROP HAUT (a baisser): {len(dn)}  (somme {round(sum(r['delta'] for r in dn)):+} EUR)")
print(f"     dont total stocke TROP BAS (a monter)  : {len(up)}  (somme {round(sum(r['delta'] for r in up)):+} EUR)")
print(f"     dont sur devis payes (completed/deposit_paid): {sum(1 for r in correctable if r['status'] in ('completed','deposit_paid','balance_paid'))}")
print(f"\n  DETAIL DE LIGNES recuperable (doc facture/solde vivant) :")
ph = [r for r in rows if r["placeholder"]]
print(f"     devis encore placeholder           : {len(ph)}")
print(f"     dont detail recuperable (doc vivant): {sum(1 for r in ph if r['detail_recuperable'])}")

print("\n  -- echantillon totaux a corriger --")
for r in sorted(correctable, key=lambda x: -abs(x["delta"]))[:10]:
    print(f"    {r['eid']:12} stored={r['stored']:>9} live={r['live_total']:>9} [{r['delta']:+.0f}] annule={r['cancelled_amount']:>9} {r['status']}")

out = Path("backups") / f"eval_live_docs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
out.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
print(f"\n  worklist complet (lecture seule, rien ecrit en base): {out}")
