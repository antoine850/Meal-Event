"""Phase 1 -- Societes + Contacts (document (2).csv). Dry-run par defaut; --apply pour ecrire.
Societes : 1 par nom distinct (les comptes BS de meme nom sont fusionnes), dedoublonnees vs
l'existant. Contacts : dedoublonnes par email + collision avec l'existant.
--events=ID1,ID2 limite aux contacts des events choisis (canary)."""
import sys
from collections import defaultdict
from lib import (load_env, load_csv, Supa, s, ORG_ID, SOURCE,
                 CONTACTS_CSV, EVENTS_CSV, arg_events, section, line)

CO_PREFIX = "bs-co:"
JUNK_COMPANY = {"particulier", "particuliers", "non", "n/a", "na", "néant", "neant",
                "aucun", "aucune", "nc", "-", "--", ".", "..", "/", "?", "x"}


def cnorm(n):
    return " ".join((n or "").strip().lower().split())


def is_junk_company(name):
    k = cnorm(name)
    return k in JUNK_COMPANY or len(k) <= 1


def build_companies(rows):
    by_name, account_to_name = {}, {}
    for r in rows:
        acc, name = s(r.get("account_id")), s(r.get("company_name"))
        if not acc or not name or is_junk_company(name):
            continue
        key = cnorm(name)
        account_to_name[acc] = key
        if key in by_name:
            continue
        by_name[key] = {
            "organization_id": ORG_ID, "external_source": SOURCE, "external_id": CO_PREFIX + key,
            "name": name,
            "tva_number": s(r.get("company_vat_number")),
            "address": s(r.get("company_address_1")),
            "postal_code": s(r.get("company_postal_code")),
            "city": s(r.get("company_city")),
            "country": s(r.get("company_country")),
            "billing_address": s(r.get("company_address_1")),
            "billing_postal_code": s(r.get("company_postal_code")),
            "billing_city": s(r.get("company_city")),
            "billing_country": s(r.get("company_country")),
            "notes": s(r.get("company_activity_sector")),
        }
    return by_name, account_to_name


def first_name_of(r):
    return (s(r.get("contact_firstname"))
            or s(r.get("contact_lastname"))
            or (s(r.get("contact_email")) or "@").split("@")[0]
            or "Contact")


def build_contacts(rows):
    by_email, no_email = {}, []
    for r in rows:
        cid = s(r.get("contact_id"))
        if not cid:
            continue
        em = s(r.get("contact_email"))
        rec = {
            "organization_id": ORG_ID, "external_source": SOURCE, "external_id": cid,
            "first_name": first_name_of(r),
            "last_name": s(r.get("contact_lastname")),
            "email": em,
            "mobile": s(r.get("contact_mobile_phone")),
            "phone": s(r.get("contact_land_phone")),
            "job_title": s(r.get("contact_job_title")),
            "address": s(r.get("contact_address_1")),
            "postal_code": s(r.get("contact_postal_code")),
            "city": s(r.get("contact_city")),
            "source": "Booking Shake",
            "notes": s(r.get("contact_comments")),
            "_account_id": s(r.get("account_id")),
        }
        if em:
            by_email.setdefault(em.lower(), rec)
        else:
            no_email.append(rec)
    return by_email, no_email


def existing_companies(db, orgf):
    try:
        rows = db.get_all("companies", "id,name,external_id", orgf)
    except RuntimeError:
        rows = db.get_all("companies", "id,name", orgf)
    by_extid = {c["external_id"]: c["id"] for c in rows if c.get("external_id")}
    by_name = {cnorm(c["name"]): c["id"] for c in rows if c.get("name")}
    return by_extid, by_name


def main():
    apply = "--apply" in sys.argv
    rows = load_csv(CONTACTS_CSV)
    events = arg_events()
    if events:
        ev = load_csv(EVENTS_CSV)
        emails = {(s(r.get("client_email")) or "").lower() for r in ev if s(r.get("event_id")) in events}
        emails.discard("")
        rows = [r for r in rows if (s(r.get("contact_email")) or "").lower() in emails]
    companies, account_to_name = build_companies(rows)
    by_email, no_email = build_contacts(rows)

    url, key, _ = load_env()
    db = Supa(url, key)
    orgf = f"organization_id=eq.{ORG_ID}"

    try:
        ex_contacts = db.get_all("contacts", "id,email,external_source,external_id", orgf)
    except RuntimeError:
        ex_contacts = db.get_all("contacts", "id,email", orgf)
    email_owner = defaultdict(list)
    for c in ex_contacts:
        if c.get("email"):
            email_owner[c["email"].strip().lower()].append((c.get("external_source"), c.get("external_id")))

    by_extid, by_name_ex = existing_companies(db, orgf)
    name_to_id, to_create = {}, []
    for key, comp in companies.items():
        cid = by_extid.get(comp["external_id"]) or by_name_ex.get(key)
        if cid:
            name_to_id[key] = cid
        else:
            to_create.append(comp)

    all_contacts = list(by_email.values()) + no_email
    to_write, skipped = [], 0
    for c in all_contacts:
        em = c.get("email")
        if em and [o for o in email_owner.get(em.lower(), []) if o != (SOURCE, c["external_id"])]:
            skipped += 1
            continue
        to_write.append(c)

    rows_with_email = sum(1 for r in rows if s(r.get("contact_email")))
    section("PHASE 1 -- SOCIETES + CONTACTS  [%s]" % ("APPLY" if apply else "DRY-RUN"))
    line("lignes source", len(rows))
    line("societes (noms distincts)", len(companies))
    line("  reliees a une societe existante", len(companies) - len(to_create))
    line("  >> societes a creer", len(to_create))
    line("contacts source avec email", rows_with_email)
    line("  doublons d'email fusionnes", rows_with_email - len(by_email))
    line("contacts sans email", len(no_email))
    line("contacts ignores (email deja en prod)", skipped)
    line(">> contacts a ecrire", len(to_write))

    if not apply:
        print("\n(dry-run: aucune ecriture. Migration requise avant --apply.)")
        return

    db.upsert("companies", to_create, "organization_id,external_source,external_id")
    for c in db.get_all("companies", "id,external_id", orgf):
        ext = c.get("external_id") or ""
        if ext.startswith(CO_PREFIX):
            name_to_id[ext[len(CO_PREFIX):]] = c["id"]
    for c in to_write:
        c["company_id"] = name_to_id.get(account_to_name.get(c.pop("_account_id", None)))
    db.upsert("contacts", to_write, "organization_id,external_source,external_id")
    line(">> societes creees", len(to_create))
    line(">> contacts ecrits", len(to_write))


if __name__ == "__main__":
    main()
