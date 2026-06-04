"""Phase 3 -- Facturation -> quotes (1/event) + quote_items + payments.
Modele : quote.total_ttc = event.amount_paid + event.amount_waiting (le vrai total, avoirs
deja nets) ; payments = lignes 'Paye' (= l'encaisse). L'app calcule Reste = total - encaisse.
Events 100% credites (total <= 0) -> pas de devis. Necessite phases 1 et 2 (--apply).
--events=ID1,ID2 limite a quelques events (canary)."""
import sys
from collections import defaultdict
from lib import (load_env, load_csv, Supa, s, dec, date_iso, arg_events,
                 ORG_ID, SOURCE, BILLING_CSV, EVENTS_CSV, PAYMENT_METHOD_MAP, section, line)

AVOIR_TYPES = {"acompte-avoir", "solde-avoir", "facture-avoir"}


def dtype(d):
    return (s(d.get("type")) or "facture").lower()


def norm_method(v):
    v = s(v)
    return PAYMENT_METHOD_MAP.get(v.lower()) if v else None


def is_paid(st):
    return (st or "").strip().lower() in ("payé", "paye")


def paid_lines(doc):
    typ, idx = dtype(doc), s(doc.get("index")) or "0"
    for n in (1, 2, 3, 4):
        amt = dec(doc.get(f"payment_{n}_amount"))
        if amt is None or not is_paid(doc.get(f"payment_{n}_status")):
            continue
        yield {
            "external_id": f"{idx}:{typ}:p{n}",
            "amount": amt,
            "payment_type": "deposit" if typ == "acompte" else "balance",
            "payment_modality": {"acompte": "acompte", "solde": "solde"}.get(typ, "autre"),
            "payment_method": norm_method(doc.get(f"payment_{n}_method")),
            "status": "paid",
            "paid_at": date_iso(doc.get(f"payment_{n}_date")),
        }


def paid_date(doc):
    for n in (1, 2, 3, 4):
        if is_paid(doc.get(f"payment_{n}_status")):
            return date_iso(doc.get(f"payment_{n}_date"))
    return None


def build(rows, ev_amt):
    by_event = defaultdict(list)
    avoir = 0
    for r in rows:
        eid = s(r.get("event_id"))
        if not eid:
            continue
        r["_avoir"] = dtype(r) in AVOIR_TYPES
        avoir += r["_avoir"]
        by_event[eid].append(r)

    quotes, items, payments, skipped_zero = [], [], [], 0
    for eid, docs in by_event.items():
        live = [d for d in docs if not d["_avoir"]]
        if not live:
            continue
        ap, aw = ev_amt.get(eid, (0.0, 0.0))
        total = round(ap + aw)
        if total <= 0:  # event entierement credite / annule -> pas de devis
            skipped_zero += 1
            continue
        sum_ttc = sum((dec(d.get("amountTTC")) or 0) for d in live)
        sum_ht = sum((dec(d.get("amountHT")) or 0) for d in live)
        ht = round(total * sum_ht / sum_ttc, 2) if sum_ttc else round(total / 1.1, 2)
        ptype = lambda t: next((d for d in live if dtype(d) == t), None)
        facture, acompte, solde = ptype("facture"), ptype("acompte"), ptype("solde")
        main = facture or max(live, key=lambda d: dec(d.get("amountTTC")) or 0)
        dates = [d for d in (date_iso(x.get("creationDate")) for x in live) if d]
        status = "completed" if (ap > 0 and aw <= 0) else ("deposit_paid" if ap > 0 else "draft")
        quotes.append({
            "organization_id": ORG_ID, "external_source": SOURCE, "external_id": eid,
            "quote_number": s(main.get("name")) or (acompte and s(acompte.get("name"))) or f"BS-{eid}",
            "status": status,
            "total_ht": ht, "total_ttc": float(total), "total_tva": round(total - ht, 2),
            "deposit_amount_override": dec(acompte.get("amountTTC")) if acompte else None,
            "deposit_paid_at": paid_date(acompte) if acompte else None,
            "balance_paid_at": paid_date(solde) if solde else None,
            "pdf_url": s(main.get("url")),
            "quote_date": min(dates) if dates else None,
            "notes": "Importe Booking Shake" + (" (avoirs presents)" if len(docs) > len(live) else ""),
            "_event": eid,
        })
        items.append({
            "external_source": SOURCE, "external_id": eid,
            "name": "Prestation (import Booking Shake)",
            "quantity": 1, "unit_price": ht, "tva_rate": round((total - ht) / ht * 100) if ht else 20,
            "discount_amount": 0, "total_ht": ht, "total_ttc": float(total),
            "item_type": "product", "position": 0, "_event": eid,
        })
        inst = [d for d in live if dtype(d) in ("acompte", "solde")]
        inst_pay = [p for d in inst for p in paid_lines(d)]
        chosen = inst_pay if inst_pay else [p for d in live for p in paid_lines(d)]
        for p in chosen:
            p.update({"organization_id": ORG_ID, "external_source": SOURCE,
                      "external_id": f"{eid}:{p['external_id']}", "_event": eid})
            payments.append(p)
    return quotes, items, payments, avoir, len(by_event), skipped_zero


def main():
    apply = "--apply" in sys.argv
    events = arg_events()
    rows = load_csv(BILLING_CSV)
    if events:
        rows = [r for r in rows if s(r.get("event_id")) in events]
    ev_amt = {s(e.get("event_id")): ((dec(e.get("amount_paid")) or 0.0), (dec(e.get("amount_waiting")) or 0.0))
              for e in load_csv(EVENTS_CSV) if s(e.get("event_id"))}
    quotes, items, payments, avoir, n_events, skipped_zero = build(rows, ev_amt)

    total_facture = round(sum(q["total_ttc"] for q in quotes))
    total_encaisse = round(sum(p["amount"] for p in payments))
    section("PHASE 3 -- FACTURATION -> QUOTES + ITEMS + PAYMENTS  [%s]" % ("APPLY" if apply else "DRY-RUN"))
    line("lignes source / avoirs exclus", f"{len(rows)} / {avoir}")
    line("events factures", n_events)
    line("  events 100% credites (pas de devis)", skipped_zero)
    line(">> quotes a ecrire", len(quotes))
    line(">> quote_items a ecrire", len(items))
    line(">> payments 'Paye' a ecrire", len(payments))
    line("TOTAL facture (somme devis)", total_facture)
    line("TOTAL encaisse (somme paiements)", total_encaisse)
    line("RESTE a payer (facture - encaisse)", total_facture - total_encaisse)

    if not apply:
        print("\n(dry-run: aucune ecriture. Faire phases 1 et 2 --apply avant.)")
        return

    url, key, _ = load_env()
    db = Supa(url, key)
    orgf = f"organization_id=eq.{ORG_ID}"
    book_map = {b["external_id"]: b["id"] for b in db.get_all("bookings", "id,external_id", orgf) if b.get("external_id")}
    for q in quotes:
        q["booking_id"] = book_map.get(q.pop("_event"))
    db.upsert("quotes", quotes, "organization_id,external_source,external_id")
    quote_map = {q["external_id"]: q["id"] for q in db.get_all("quotes", "id,external_id", orgf) if q.get("external_id")}
    for it in items:
        it["quote_id"] = quote_map.get(it.pop("_event"))
    db.upsert("quote_items", [it for it in items if it.get("quote_id")], "external_source,external_id")
    for p in payments:
        eid = p.pop("_event")
        p["booking_id"] = book_map.get(eid)
        p["quote_id"] = quote_map.get(eid)
    db.upsert("payments", payments, "organization_id,external_source,external_id")
    line(">> quotes ecrits", len(quotes))
    line(">> quote_items ecrits", len([it for it in items if it.get("quote_id")]))
    line(">> payments ecrits", len(payments))


if __name__ == "__main__":
    main()
