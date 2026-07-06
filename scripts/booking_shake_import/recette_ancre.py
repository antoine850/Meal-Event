"""Recette lecture seule du modele "ancre unique" (PU stocke = source de verite, plus de
recalcul ceil-par-ligne a l'affichage). Mesure l'etat de la donnee avant/apres le refactor,
ne modifie RIEN (aucun patch, aucune ecriture). A lancer en baseline puis apres deploiement
pour comparer.

Sections :
1. Lignes non round-trip (le total stocke ne se reconstruit pas depuis le PU ancre) --
   population historique qui reste telle quelle sous le modele "lecture stockee".
2. Headers desynchronises (total_ttc devis != somme des lignes remisee) -- les BS sont
   listes nominativement pour arbitrage manuel.
3. PU > 2 decimales (le PU exact necessite plus de 2 decimales) -- population "PU adaptatif".
4. Taux de TVA non legaux (chantier TVA differe, pour memoire).
"""
import math
from collections import Counter, defaultdict
from lib import load_env, Supa, section, line

LEGAL_RATES = {0, 2.1, 5.5, 10, 20}
TOL_LINE = 0.005
TOL_HEADER = 0.01


def round2(n):
    if n is None:
        return 0.0
    s = 1 if n >= 0 else -1
    return s * math.floor((abs(n) + 1e-9) * 100 + 0.5) / 100


def n(x):
    return x if x is not None else 0


def src_of(row):
    return row.get("external_source") or "natif"


db = Supa(*load_env()[:2])

items = db.get_all(
    "quote_items",
    "id,quote_id,name,quantity,unit_price,unit_price_ttc,price_entry_mode,tva_rate,"
    "discount_amount,total_ht,total_ttc,item_type,external_source",
)
quotes = {q["id"]: q for q in db.get_all(
    "quotes",
    "id,quote_number,status,external_source,total_ht,total_ttc,discount_percentage",
)}

prod_items = [it for it in items if it.get("item_type") != "extra"]
by_quote = defaultdict(list)
for it in prod_items:
    by_quote[it["quote_id"]].append(it)

section("RECETTE ANCRE UNIQUE (lecture seule)")
line("quote_items total", len(items))
line("  dont lignes produit (item_type != extra)", len(prod_items))
line("quotes total", len(quotes))

# 1. Lignes non round-trip -------------------------------------------------
section("1. Lignes non round-trip (total stocke non reproductible depuis le PU ancre)")
non_roundtrip = []
for it in prod_items:
    qty, disc = n(it["quantity"]), n(it["discount_amount"])
    ttc_mode = it.get("price_entry_mode") == "ttc"
    anchor_pu = it.get("unit_price_ttc") if ttc_mode else it.get("unit_price")
    if anchor_pu is None:
        non_roundtrip.append(it)
        continue
    stored = it.get("total_ttc") if ttc_mode else it.get("total_ht")
    expected = round2(qty * anchor_pu - disc)
    if abs(expected - n(stored)) > TOL_LINE:
        non_roundtrip.append(it)

line("total", len(non_roundtrip))
by_src = Counter(src_of(it) for it in non_roundtrip)
by_mode = Counter(it.get("price_entry_mode") or "ht" for it in non_roundtrip)
print("\n  -- par source --")
for k, v in sorted(by_src.items(), key=lambda x: -x[1]):
    print(f"     {v:5}  {k}")
print("\n  -- par price_entry_mode --")
for k, v in sorted(by_mode.items(), key=lambda x: -x[1]):
    print(f"     {v:5}  {k}")

# 2. Headers desynchronises -------------------------------------------------
section("2. Headers desynchronises (total_ttc devis vs somme lignes remisee)")
desync = []
for qid, prods in by_quote.items():
    q = quotes.get(qid)
    if not q:
        continue
    sub_ttc = round2(sum(n(it.get("total_ttc")) for it in prods))
    disc_pct = n(q.get("discount_percentage"))
    mult = (1 - disc_pct / 100) if disc_pct > 0 else 1
    computed = round2(sub_ttc * mult)
    stored = n(q.get("total_ttc"))
    if abs(computed - stored) > TOL_HEADER:
        desync.append({"quote": q, "computed": computed, "stored": stored})

line("total", len(desync))
by_src2 = Counter(src_of(d["quote"]) for d in desync)
by_status = Counter((src_of(d["quote"]), d["quote"].get("status") or "?") for d in desync)
print("\n  -- par source --")
for k, v in sorted(by_src2.items(), key=lambda x: -x[1]):
    print(f"     {v:5}  {k}")
print("\n  -- par source/statut --")
for k, v in sorted(by_status.items(), key=lambda x: -x[1]):
    print(f"     {v:5}  {k[0]:14} {k[1]}")

bs_desync = [d for d in desync if src_of(d["quote"]) == "booking_shake"]
print(f"\n  -- liste nominative booking_shake ({len(bs_desync)}) : id / numero / stocke -> calcule --")
for d in sorted(bs_desync, key=lambda x: -abs(x["computed"] - x["stored"])):
    q = d["quote"]
    print(f"     {q['id']:38} {(q.get('quote_number') or '?'):12} "
          f"stocke {d['stored']:>10.2f} -> calcule {d['computed']:>10.2f}  ({d['computed']-d['stored']:+.2f})")

# 3. PU > 2 decimales --------------------------------------------------------
section("3. PU adaptatif (PU exact necessite plus de 2 decimales)")
adaptive = []
for it in prod_items:
    qty = n(it["quantity"])
    if qty <= 0:
        continue
    total = it.get("total_ttc") if it.get("price_entry_mode") == "ttc" else it.get("total_ht")
    if total is None:
        continue
    exact_pu = total / qty
    if abs(round(exact_pu, 2) * qty - total) > TOL_LINE:
        adaptive.append(it)

line("total", len(adaptive))
by_src3 = Counter(src_of(it) for it in adaptive)
print("\n  -- par source --")
for k, v in sorted(by_src3.items(), key=lambda x: -x[1]):
    print(f"     {v:5}  {k}")

# 4. Taux non legaux ----------------------------------------------------------
section("4. Taux de TVA non legaux (chantier TVA differe)")
illegal = [it for it in items if n(it.get("tva_rate")) not in LEGAL_RATES]
line("total", len(illegal))
by_src4 = Counter(src_of(it) for it in illegal)
print("\n  -- par source --")
for k, v in sorted(by_src4.items(), key=lambda x: -x[1]):
    print(f"     {v:5}  {k}")

section("Resume")
print(f"  non round-trip={len(non_roundtrip)}  headers desync={len(desync)} "
      f"(dont BS={len(bs_desync)})  PU adaptatif={len(adaptive)}  taux non legaux={len(illegal)}")
