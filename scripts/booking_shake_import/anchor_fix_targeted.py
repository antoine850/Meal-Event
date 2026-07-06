"""Re-ancrage cible de deux petites populations avant le passage au modele "ancre unique"
(plus de recalcul ceil-par-ligne, le PU stocke fait foi).

Population A -- lignes de BROUILLONS sans ancre TTC (unit_price_ttc NULL). On les rattache
au catalogue produit du restaurant du devis (match exact sur le nom) pour leur donner un
PU TTC propre : price_entry_mode='ttc', unit_price_ttc/unit_price repris du produit, totaux
recalcules dessus. Sans match produit, remise ligne deja posee (frais negocie au cas par
cas, ex. "Frais de privatisation"), ou nom ambigu (plusieurs produits meme nom/restaurant) :
la ligne est listee, jamais touchee. Garde anti-derive de prix : si le prix catalogue actuel
diverge du prix historique implique par la ligne (total stocke / qte), le catalogue a change
depuis la vente -- la ligne est listee a part pour audit, jamais reancree dessus.

Population B -- les 4 lignes connues en mode TTC avec remise ligne mal appliquee (le total
stocke ne correspond pas a qty*PU_ttc - remise) : on recalcule le total sur le bon cote.

Dans les deux cas, le header du devis (total_ht/tva/ttc) est recompose apres coup a partir
des lignes produit corrigees, remise en pied appliquee une fois.

Dry-run par defaut (aucune ecriture). --apply : snapshot avant, puis patch lignes + headers."""
import sys, json, math
from datetime import datetime
from pathlib import Path
from collections import defaultdict
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, section, line

BACKUP_DIR = Path(__file__).resolve().parent / "backups"


def round2(n):
    if n is None:
        return 0.0
    s = 1 if n >= 0 else -1
    return s * math.floor((abs(n) + 1e-9) * 100 + 0.5) / 100


def n(x):
    return x if x is not None else 0


def main():
    apply = "--apply" in sys.argv
    only_a = "--only-a" in sys.argv  # n'ecrire que la Population A (brouillons catalogue)
    db = Supa(*load_env()[:2])

    quotes = db.get_all(
        "quotes",
        "id,quote_number,status,booking_id,discount_percentage,total_ht,total_ttc",
    )
    bookings = {b["id"]: b for b in db.get_all("bookings", "id,restaurant_id")}
    # products.price_entry_mode n'existe pas encore en prod (migration ecrite, pas appliquee) ->
    # select defensif sans la colonne, mode suppose 'ttc' (tous les produits actuels sont TTC).
    products = db.get_all(
        "products", "id,name,unit_price_ht,unit_price_ttc,tva_rate"
    )
    prod_restaurants = db.get_all("product_restaurants", "product_id,restaurant_id")

    restaurants_by_product = defaultdict(list)
    for pr in prod_restaurants:
        restaurants_by_product[pr["product_id"]].append(pr["restaurant_id"])

    # lookup (restaurant_id, nom en minuscules) -> produit. Le catalogue contient des doublons
    # (meme nom, meme restaurant, prix differents -- ex. "Frais de privatisation" a 2 fiches) ->
    # une correspondance ambigue est ecartee (None), jamais choisie au hasard.
    catalog = {}
    for p in products:
        name_key = (p.get("name") or "").strip().lower()
        if not name_key:
            continue
        for rid in restaurants_by_product.get(p["id"], []):
            key = (rid, name_key)
            catalog[key] = None if key in catalog else p

    draft_quotes = {q["id"]: q for q in quotes if q.get("status") == "draft"}
    items = db.get_all(
        "quote_items",
        "id,quote_id,name,quantity,unit_price,unit_price_ttc,price_entry_mode,tva_rate,"
        "discount_amount,total_ht,total_ttc,item_type",
    )
    by_quote = defaultdict(list)
    for it in items:
        by_quote[it["quote_id"]].append(it)

    # ---------------------------------------------------------------- Population A
    # Exclut les lignes portant deja une remise : ce sont des frais negocies au cas par cas
    # (ex. "Frais de privatisation" a 6000 HT remise a 2400 HT) -- reancrer sur le prix
    # catalogue et reappliquer l'ancienne remise HT en TTC produirait un total incoherent
    # (voire negatif). Verifie sur le dry-run initial : a laisser de cote, pas une lacune du
    # matching.
    plan_a, unmatched_a, skipped_discounted_a, skipped_pricedrift_a = [], [], [], []
    for it in items:
        if it.get("item_type") == "extra":
            continue
        q = draft_quotes.get(it["quote_id"])
        if not q or it.get("unit_price_ttc") is not None:
            continue
        if n(it.get("discount_amount")):
            skipped_discounted_a.append((q, it))
            continue
        booking = bookings.get(q.get("booking_id"))
        restaurant_id = booking.get("restaurant_id") if booking else None
        name_key = (it.get("name") or "").strip().lower()
        product = catalog.get((restaurant_id, name_key)) if restaurant_id else None
        if not product:
            unmatched_a.append((q, it))
            continue
        qty = n(it["quantity"])
        pu_ttc = product.get("unit_price_ttc")
        # Garde anti-derive : le catalogue a pu changer de prix depuis que la ligne a ete
        # negociee (ex. "Menu Formule Complete" a 42 TTC aujourd'hui, vendu 35 TTC a l'epoque,
        # sans discount_amount pose). On ne fait confiance au catalogue que si son prix
        # correspond a ce que la ligne implique deja (total_ttc/qty, sinon total_ht/qty * mult).
        if qty <= 0 or pu_ttc is None:
            unmatched_a.append((q, it))
            continue
        tva = n(product.get("tva_rate")) or n(it.get("tva_rate"))
        if it.get("total_ttc") is not None:
            implied_ttc_unit = n(it["total_ttc"]) / qty
        elif it.get("total_ht") is not None:
            implied_ttc_unit = round2(n(it["total_ht"]) * (1 + tva / 100)) / qty
        else:
            implied_ttc_unit = None
        if implied_ttc_unit is not None and abs(implied_ttc_unit - pu_ttc) > 0.02:
            skipped_pricedrift_a.append((q, it, implied_ttc_unit, pu_ttc))
            continue
        pu_ht = product.get("unit_price_ht")
        new_ttc = round2(qty * n(pu_ttc))
        new_ht = round2(new_ttc / (1 + tva / 100)) if tva > -100 else 0.0
        plan_a.append({
            "quote": q, "item": it,
            "price_entry_mode": "ttc",
            "unit_price_ttc": pu_ttc,
            "unit_price": pu_ht,
            "tva_rate": tva,
            "total_ttc": new_ttc,
            "total_ht": new_ht,
        })

    # ---------------------------------------------------------------- Population B
    plan_b = []
    skip_b_engaged = []  # devis engage/facture -> revue manuelle, jamais d'auto-fix
    for it in items:
        if it.get("item_type") == "extra":
            continue
        if it.get("price_entry_mode") != "ttc" or not n(it.get("discount_amount")):
            continue
        qty, disc = n(it["quantity"]), n(it["discount_amount"])
        pu_ttc = it.get("unit_price_ttc")
        if pu_ttc is None:
            continue
        expected_ttc = round2(qty * pu_ttc - disc)
        if abs(expected_ttc - n(it.get("total_ttc"))) <= 0.005:
            continue
        # Brouillons uniquement : un devis engage/facture garde son total facture,
        # on ne corrige jamais automatiquement un montant deja encaisse.
        if it["quote_id"] not in draft_quotes:
            skip_b_engaged.append(it)
            continue
        tva = n(it.get("tva_rate"))
        new_ht = round2(expected_ttc / (1 + tva / 100)) if tva > -100 else 0.0
        plan_b.append({
            "item": it,
            "total_ttc": expected_ttc,
            "total_ht": new_ht,
        })

    quotes_by_id = {q["id"]: q for q in quotes}
    for p in plan_b:
        p["quote"] = quotes_by_id.get(p["item"]["quote_id"])

    if only_a:  # on ne traite que la Population A : headers/snapshot/ecritures A seuls
        plan_b = []

    # ---------------------------------------------------------------- headers affectes
    new_line_totals = {}  # item_id -> (total_ht, total_ttc)
    for p in plan_a:
        new_line_totals[p["item"]["id"]] = (p["total_ht"], p["total_ttc"])
    for p in plan_b:
        new_line_totals[p["item"]["id"]] = (p["total_ht"], p["total_ttc"])

    affected_quote_ids = {p["quote"]["id"] for p in plan_a if p["quote"]} | \
                          {p["quote"]["id"] for p in plan_b if p["quote"]}
    header_plan = []
    for qid in affected_quote_ids:
        q = quotes_by_id[qid]
        prods = [it for it in by_quote.get(qid, []) if it.get("item_type") != "extra"]
        sub_ht = round2(sum(new_line_totals.get(it["id"], (it.get("total_ht"), it.get("total_ttc")))[0]
                            for it in prods))
        sub_ttc = round2(sum(new_line_totals.get(it["id"], (it.get("total_ht"), it.get("total_ttc")))[1]
                             for it in prods))
        disc_pct = n(q.get("discount_percentage"))
        mult = (1 - disc_pct / 100) if disc_pct > 0 else 1
        tot_ht = round2(sub_ht * mult)
        tot_ttc = round2(sub_ttc * mult)
        header_plan.append({
            "quote": q, "total_ht": tot_ht, "total_tva": round2(tot_ttc - tot_ht), "total_ttc": tot_ttc,
        })

    # ---------------------------------------------------------------- rapport
    section(f"ANCHOR FIX CIBLE  [{'APPLY' if apply else 'DRY-RUN'}]")
    line("population A (brouillons sans ancre TTC, matchees catalogue)", len(plan_a))
    line("population A non matchee (laissee intacte)", len(unmatched_a))
    line("population A ecartee : remise ligne deja presente (laissee intacte)", len(skipped_discounted_a))
    line("population A ecartee : prix catalogue diverge du prix historique (laissee intacte)", len(skipped_pricedrift_a))
    line("population B (ttc + remise, mauvais cote) [brouillons]", len(plan_b))
    line("population B ecartee : devis engage/facture (revue manuelle)", len(skip_b_engaged))
    line("headers devis a recomposer", len(header_plan))

    print("\n  -- Population A : devis / ligne / ancien total_ttc -> nouveau --")
    for p in plan_a[:30]:
        q, it = p["quote"], p["item"]
        old = it.get("total_ttc")
        print(f"     {q['id'][:8]} {(q.get('quote_number') or '?'):10} "
              f"{(it.get('name') or '?')[:30]:32} {old!r:>10} -> {p['total_ttc']:>10.2f}")
    if len(plan_a) > 30:
        print(f"     ... ({len(plan_a) - 30} de plus)")

    print("\n  -- Population B : devis / ligne / ancien total_ttc -> nouveau --")
    for p in plan_b:
        q, it = p["quote"], p["item"]
        print(f"     {(q['id'][:8] if q else '?'):8} {(q.get('quote_number') if q else '?'):10} "
              f"{(it.get('name') or '?')[:30]:32} {n(it.get('total_ttc')):>10.2f} -> {p['total_ttc']:>10.2f}")

    if skip_b_engaged:
        print(f"\n  -- Population B ECARTEE : devis engage/facture (revue manuelle, {len(skip_b_engaged)}) --")
        for it in skip_b_engaged:
            q = quotes_by_id.get(it["quote_id"])
            print(f"     {(q['id'][:8] if q else '?'):8} {(q.get('quote_number') if q else '?'):12} "
                  f"statut={(q.get('status') if q else '?'):14} {(it.get('name') or '?')[:26]:28} "
                  f"total {n(it.get('total_ttc')):>10.2f}")

    print(f"\n  -- lignes de brouillon sans produit correspondant (non touchees, {len(unmatched_a)}) --")
    for q, it in unmatched_a[:30]:
        print(f"     {q['id'][:8]} {(q.get('quote_number') or '?'):10} {(it.get('name') or '?')[:40]}")
    if len(unmatched_a) > 30:
        print(f"     ... ({len(unmatched_a) - 30} de plus)")

    print(f"\n  -- lignes de brouillon avec remise deja posee (non touchees, {len(skipped_discounted_a)}) --")
    for q, it in skipped_discounted_a[:30]:
        print(f"     {q['id'][:8]} {(q.get('quote_number') or '?'):10} {(it.get('name') or '?')[:30]:32} "
              f"remise {n(it.get('discount_amount')):>8.2f}")
    if len(skipped_discounted_a) > 30:
        print(f"     ... ({len(skipped_discounted_a) - 30} de plus)")

    print(f"\n  -- lignes ecartees : prix catalogue divergent du prix historique implique "
          f"(a auditer, {len(skipped_pricedrift_a)}) --")
    for q, it, implied, cat in skipped_pricedrift_a[:30]:
        print(f"     {q['id'][:8]} {(q.get('quote_number') or '?'):10} {(it.get('name') or '?')[:28]:30} "
              f"historique {implied:>8.2f} vs catalogue {cat:>8.2f}")
    if len(skipped_pricedrift_a) > 30:
        print(f"     ... ({len(skipped_pricedrift_a) - 30} de plus)")

    print("\n  -- headers recomposes (devis : ancien total_ttc -> nouveau) --")
    for h in header_plan[:20]:
        q = h["quote"]
        print(f"     {q['id'][:8]} {(q.get('quote_number') or '?'):10} "
              f"{n(q.get('total_ttc')):>10.2f} -> {h['total_ttc']:>10.2f}")

    if not apply:
        print("\n(dry-run: aucune ecriture. --apply pour ecrire, snapshot inclus.)")
        sys.exit(0)

    # ---------------------------------------------------------------- ecriture (--apply uniquement)
    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    snap = {
        "items": [
            {"id": p["item"]["id"], "quote_id": p["item"]["quote_id"],
             "price_entry_mode": p["item"].get("price_entry_mode"),
             "unit_price": p["item"].get("unit_price"),
             "unit_price_ttc": p["item"].get("unit_price_ttc"),
             "total_ht": p["item"].get("total_ht"), "total_ttc": p["item"].get("total_ttc")}
            for p in plan_a + plan_b
        ],
        "quotes": [
            {"id": h["quote"]["id"], "total_ht": h["quote"].get("total_ht"),
             "total_tva": h["quote"].get("total_tva"), "total_ttc": h["quote"].get("total_ttc")}
            for h in header_plan
        ],
    }
    snap_path = BACKUP_DIR / f"anchor_fix_snapshot_{ts}.json"
    snap_path.write_text(json.dumps(snap, ensure_ascii=False, indent=1))
    line("snapshot ecrit", snap_path)

    for p in plan_a:
        db.patch("quote_items", f"id=eq.{p['item']['id']}", {
            "price_entry_mode": p["price_entry_mode"],
            "unit_price_ttc": p["unit_price_ttc"],
            "unit_price": p["unit_price"],
            "total_ht": p["total_ht"],
            "total_ttc": p["total_ttc"],
        })
    for p in plan_b:
        db.patch("quote_items", f"id=eq.{p['item']['id']}", {
            "total_ht": p["total_ht"],
            "total_ttc": p["total_ttc"],
        })
    for h in header_plan:
        db.patch("quotes", f"id=eq.{h['quote']['id']}", {
            "total_ht": h["total_ht"],
            "total_tva": h["total_tva"],
            "total_ttc": h["total_ttc"],
        })
    line(">> lignes A ecrites", len(plan_a))
    line(">> lignes B ecrites", len(plan_b))
    line(">> headers ecrits", len(header_plan))


if __name__ == "__main__":
    main()
