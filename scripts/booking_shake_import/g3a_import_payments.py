"""G3/A -- importe le DELTA d'encaissements BS manquants dans ME. ADDITIF, paiements seulement.

Reutilise la logique de phase3_billing (paid_lines, cle {eid}:{idx}:{typ}:p{n}, type deposit/balance)
mais ne touche QUE la table payments. Docs actifs uniquement (avoir + invoice_status=Annule exclus).
Anti-double-compte par event+montant contre l'existant ME (les index peuvent bouger entre exports,
donc on ne se fie pas a la cle). Par event : prefere les lignes acompte/solde, sinon facture (evite
le double-compte de la facture qui reprend acompte+solde). Dry-run par defaut ; --apply pour ecrire."""
import sys, json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import load_env, Supa, ORG_ID, SOURCE, BILLING_CSV, load_csv, s, dec, section, line
from phase3_billing import paid_lines, dtype, AVOIR_TYPES

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])


def active(d):
    return dtype(d) not in AVOIR_TYPES and (s(d.get("invoice_status")) or "") != "Annulé"


# 1. candidats : lignes payees des docs actifs, par event, regle 'prefere acompte/solde'
bi = load_csv(BILLING_CSV)
by_event = defaultdict(list)
for r in bi:
    eid = s(r.get("event_id"))
    if eid and active(r):
        by_event[eid].append(r)

cand = []  # (eid, row)
for eid, docs in by_event.items():
    inst = [d for d in docs if dtype(d) in ("acompte", "solde")]
    src = inst if inst else docs
    for d in src:
        for p in paid_lines(d):
            if not p["amount"] or p["amount"] <= 0:
                continue
            p["external_id"] = f"{eid}:{p['external_id']}"
            cand.append((eid, p))

# 2. ME : paiements payes par event (montants, pour le dedup)
bk = db.get_all("bookings", "id,external_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
bid_by_eid = {b["external_id"]: b["id"] for b in bk if b.get("external_id")}
eid_by_bid = {i: e for e, i in bid_by_eid.items()}
me_amts = defaultdict(list)
for p in db.get_all("payments", "booking_id,amount,status", f"organization_id=eq.{ORG_ID}&status=eq.paid"):
    eid = eid_by_bid.get(p.get("booking_id"))
    if eid and p.get("amount") is not None:
        me_amts[eid].append({"amt": round(p["amount"]), "used": False})

# 3. reconciliation par event+montant
to_import, already = [], 0
for eid, p in cand:
    pool = me_amts.get(eid, [])
    hit = next((m for m in pool if not m["used"] and abs(m["amt"] - round(p["amount"])) <= 1), None)
    if hit:
        hit["used"] = True
        already += 1
    else:
        to_import.append((eid, p))

quote_by_eid = {q["external_id"]: q["id"] for q in
                db.get_all("quotes", "id,external_id", f"external_source=eq.{SOURCE}&organization_id=eq.{ORG_ID}")
                if q.get("external_id")}

orphan = [(e, p) for e, p in to_import if e not in bid_by_eid]  # event sans booking ME -> pas d'ancrage
to_import = [(e, p) for e, p in to_import if e in bid_by_eid]

from collections import Counter
section(f"G3/A IMPORT ENCAISSEMENTS  [{'APPLY' if apply else 'DRY-RUN'}]")
line("candidats actifs (docs Paye, hors Annule/avoir)", len(cand))
line("deja en base (match event+montant)", already)
line("orphelins ecartes (event sans booking ME)", len(orphan))
line(">> A IMPORTER", f"{len(to_import)}  ({round(sum(p['amount'] for _, p in to_import))} EUR)")
line("   par type", dict(Counter(p["payment_type"] for _, p in to_import)))
line("   events concernes", len(set(e for e, _ in to_import)))
line("   sans devis ME (booking seul)", sum(1 for e, _ in to_import if e not in quote_by_eid))
print("\n  echantillon :")
for eid, p in to_import[:12]:
    print(f"    {eid:12} {round(p['amount']):>8} EUR  {p['payment_type']:8} {p['payment_method'] or '?':12} {p['paid_at']}")

if not apply:
    print("\n(dry-run: aucune ecriture. --apply pour importer.)")
    sys.exit(0)

rows = []
for eid, p in to_import:
    p.update({"organization_id": ORG_ID, "external_source": SOURCE,
              "booking_id": bid_by_eid.get(eid), "quote_id": quote_by_eid.get(eid)})
    rows.append(p)

BACKUP_DIR.mkdir(exist_ok=True)
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
(BACKUP_DIR / f"g3a_inserted_{ts}.json").write_text(
    json.dumps([r["external_id"] for r in rows], ensure_ascii=False, indent=1))
db.upsert("payments", rows, "organization_id,external_source,external_id")
print(f"\n  >> paiements importes : {len(rows)}")
print(f"  >> cles (rollback)    : backups/g3a_inserted_{ts}.json")
