"""Phase 2 -- Events -> bookings (document (1).csv). Dry-run par defaut; --apply pour ecrire.
Necessite la phase 1 (--apply) pour resoudre contact_id par email.
Assigne les commerciaux (owners) -> users ; cree des ghost users (is_active=false) pour les
ex-employes sans compte. booking.total_amount = amount_paid + amount_waiting (le vrai total),
sinon l'estimation expected_waiting. Si pas de contact (pas d'email), le nom client va en note.
--events=ID1,ID2 limite a quelques events (canary)."""
import re, sys, unicodedata
from lib import (load_env, load_csv, Supa, s, dec, date_iso, boolfr, clock, arg_events,
                 ORG_ID, SOURCE, SOURCE_MAP, EVENTS_CSV, CONTACTS_CSV,
                 VENUE_TO_RESTAURANT, STATUS_TO_ID, section, line)

BOOKINGID_RE = re.compile(r"bookingId=([A-Za-z0-9]+)")


def pick(r, *keys):
    for k in keys:
        v = s(r.get(k))
        if v:
            return v
    return None


def internal_note(r):
    for v in r.values():
        if v and "bookingshake.com" in v:
            m = BOOKINGID_RE.search(v)
            if m:
                return f"Booking Shake bookingId={m.group(1)}"
    return None


def to_int(v):
    v = s(v)
    return int(v) if v and v.isdigit() else None


def msrc(v):
    v = s(v)
    return SOURCE_MAP.get(v.lower(), v) if v else None


def nkey(n):
    return " ".join((n or "").lower().split())


def owner_tokens(raw):
    return [" ".join(p.split()) for p in (raw or "").split(",") if p.strip()]


def ghost_email(name):
    base = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return ".".join(base.lower().split()) + "@bookingshake.import"


def event_total(r):
    ap = dec(r.get("amount_paid")) or 0
    aw = dec(r.get("amount_waiting")) or 0
    t = ap + aw
    return round(t) if t > 0 else dec(r.get("expected_waiting"))


def build_booking(r):
    eid = s(r.get("event_id"))
    if not eid:
        return None, "blank_event_id"
    ev_date = date_iso(r.get("date_event")) or date_iso(r.get("creation_date"))
    if not ev_date:
        return None, "no_date"
    menu = pick(r, "Menu")
    rec = {
        "organization_id": ORG_ID, "external_source": SOURCE, "external_id": eid,
        "event_date": ev_date,
        "start_time": clock(r.get("start_hour")),
        "end_time": clock(r.get("end_hour")),
        "guests_count": to_int(r.get("pax")),
        "total_amount": event_total(r),
        "deposit_amount": dec(r.get("amount_paid")),
        "occasion": s(r.get("occasion")),
        "source": msrc(r.get("source")),
        "commentaires": s(r.get("comments")),
        "restaurant_id": VENUE_TO_RESTAURANT.get(s(r.get("venue"))),
        "status_id": STATUS_TO_ID.get(s(r.get("status"))),
        "created_at": date_iso(r.get("creation_date")),
        "budget_client": pick(r, "Budget client"),
        "allergies_regimes": pick(r, "Allergie et Régimes"),
        "format_souhaite": pick(r, "Format souhaité", "Format"),
        "mise_en_place": pick(r, "Mise en place"),
        "deroulement": pick(r, "Déroulé"),
        "prestations_souhaitees": pick(r, "Prestations souhaitées"),
        "client_preferred_time": pick(r, "Horaires souhaités client ? (KO)", "Horaires souhaitées client ? (KO)"),
        "instructions_speciales": pick(r, "Notes Clubbing"),
        "is_privatif": boolfr(pick(r, "Privatif ?")),
        "is_date_flexible": boolfr(pick(r, "Date flexible ?")),
        "is_restaurant_flexible": boolfr(pick(r, "Date/Restaurant flexible")),
        "date_signature_devis": date_iso(pick(r, "Date signature devis", "Date signature Devis")),
        "menu_boissons": pick(r, "Boissons"),
        "menu_details": {"booking_shake_menu": menu} if menu else None,
        "internal_notes": internal_note(r),
        "_email": (s(r.get("client_email")) or "").lower() or None,
        "_client_name": s(r.get("client_name")),
        "_owners": s(r.get("owners")),
        "_venue": s(r.get("venue")), "_status": s(r.get("status")),
    }
    return rec, None


def user_map(db, orgf):
    users = db.get_all("users", "id,first_name,last_name", orgf)
    return {nkey(f"{u.get('first_name', '')} {u.get('last_name', '')}"): u["id"] for u in users}


def main():
    apply = "--apply" in sys.argv
    events = arg_events()
    rows = load_csv(EVENTS_CSV)
    if events:
        rows = [r for r in rows if s(r.get("event_id")) in events]

    seen, bookings = set(), []
    skips = {"blank_event_id": 0, "no_date": 0, "dup_event_id": 0}
    unmapped_venue, unmapped_status = {}, {}
    for r in rows:
        rec, err = build_booking(r)
        if err:
            skips[err] += 1
            continue
        if rec["external_id"] in seen:
            skips["dup_event_id"] += 1
            continue
        seen.add(rec["external_id"])
        if rec["restaurant_id"] is None and rec["_venue"]:
            unmapped_venue[rec["_venue"]] = unmapped_venue.get(rec["_venue"], 0) + 1
        if rec["status_id"] is None and rec["_status"]:
            unmapped_status[rec["_status"]] = unmapped_status.get(rec["_status"], 0) + 1
        bookings.append(rec)

    url, key, _ = load_env()
    db = Supa(url, key)
    orgf = f"organization_id=eq.{ORG_ID}"
    db_emails = {c["email"].strip().lower() for c in db.get_all("contacts", "id,email", orgf) if c.get("email")}
    bs_emails = {(s(r.get("contact_email")) or "").lower() for r in load_csv(CONTACTS_CSV)}
    bs_emails.discard("")
    universe = db_emails | bs_emails
    with_email = sum(1 for b in bookings if b["_email"])
    resolvable = sum(1 for b in bookings if b["_email"] and b["_email"] in universe)

    umap = user_map(db, orgf)
    owner_names = {nm for b in bookings for nm in owner_tokens(b["_owners"])}
    unmatched = sorted({nm for nm in owner_names if nkey(nm) not in umap})

    section("PHASE 2 -- EVENTS -> BOOKINGS  [%s]" % ("APPLY" if apply else "DRY-RUN"))
    line("lignes source", len(rows))
    line("event_id vides / doublons ignores", f"{skips['blank_event_id']} / {skips['dup_event_id']}")
    line("venues / statuts non mappes", f"{sum(unmapped_venue.values())} / {sum(unmapped_status.values())}")
    line("bookings avec email (contact resolu)", resolvable)
    line("bookings sans email (nom garde en note)", len(bookings) - with_email)
    line("owners distincts / ghost a creer", f"{len(owner_names)} / {len(unmatched)}")
    if unmatched:
        line("  ->", ", ".join(unmatched))
    line(">> bookings a ecrire", len(bookings))

    if not apply:
        print("\n(dry-run: aucune ecriture. Faire phase 1 --apply avant phase 2 --apply.)")
        return

    if unmatched:
        ghosts = []
        for nm in unmatched:
            parts = nm.split()
            ghosts.append({
                "organization_id": ORG_ID, "email": ghost_email(nm),
                "first_name": parts[0], "last_name": " ".join(parts[1:]) or None,
                "role_id": None, "is_active": False,
            })
        db.upsert("users", ghosts, "organization_id,email")
        umap = user_map(db, orgf)

    email_id = {}
    for c in db.get_all("contacts", "id,email", orgf):
        if c.get("email"):
            email_id.setdefault(c["email"].strip().lower(), c["id"])
    assigned = 0
    for b in bookings:
        b["contact_id"] = email_id.get(b["_email"])
        if not b["contact_id"] and b.get("_client_name"):
            note = f"Client BS: {b['_client_name']}"
            b["internal_notes"] = f"{b['internal_notes']} | {note}" if b.get("internal_notes") else note
        ids = []
        for part in owner_tokens(b["_owners"]):
            uid = umap.get(nkey(part))
            if uid and uid not in ids:
                ids.append(uid)
        b["assigned_user_ids"] = ids or None
        assigned += bool(ids)
        for k in ("_email", "_client_name", "_owners", "_venue", "_status"):
            b.pop(k, None)
    db.upsert("bookings", bookings, "organization_id,external_source,external_id")
    line(">> bookings ecrits", len(bookings))
    line(">> contact_id resolus", sum(1 for b in bookings if b.get("contact_id")))
    line(">> assignes a un commercial", assigned)


if __name__ == "__main__":
    main()
