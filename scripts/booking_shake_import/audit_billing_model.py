"""Audit (lecture seule) du modele de facturation Booking Shake (document (3).csv) :
comprendre les types de docs, le multi-document par event, les champs name/index/linked,
les avoirs (annulations) et les revisions/multi-devis. But : decider ce qu'on doit importer."""
import sys
from collections import Counter, defaultdict
sys.path.insert(0, ".")
from lib import load_csv, BILLING_CSV, EVENTS_CSV, s, dec

bi = load_csv(BILLING_CSV)
ev = {s(e.get("event_id")): e for e in load_csv(EVENTS_CSV) if s(e.get("event_id"))}
by_event = defaultdict(list)
for r in bi:
    e = s(r.get("event_id"))
    if e:
        by_event[e].append(r)

def dtype(d): return (s(d.get("type")) or "facture").lower()

print(f"=== VOLUMETRIE ===")
print(f"  lignes facturation: {len(bi)} | events distincts: {len(by_event)}")
print(f"\n=== TYPES DE DOCUMENTS ===")
for t, n in Counter(dtype(d) for d in bi).most_common():
    print(f"  {t:18} {n}")
print(f"\n=== invoice_status ===")
for st, n in Counter(s(d.get("invoice_status")) for d in bi).most_common(10):
    print(f"  {st!s:22} {n}")

print(f"\n=== NB DOCS PAR EVENT (distribution) ===")
docs_per = Counter(len(v) for v in by_event.values())
for k in sorted(docs_per)[:8]:
    print(f"  {k} doc(s): {docs_per[k]} events")
print(f"  >5 docs: {sum(v for k,v in docs_per.items() if k>5)} events")

# champ 'linked' et 'index' : que referencent-ils ?
print(f"\n=== CHAMP 'linked' (echantillon non-vide) ===")
linked_nonempty = [r for r in bi if s(r.get("linked"))]
print(f"  docs avec 'linked' renseigne: {len(linked_nonempty)}/{len(bi)}")
for r in linked_nonempty[:5]:
    print(f"    event={s(r.get('event_id'))} type={dtype(r)} name={s(r.get('name'))} index={s(r.get('index'))} linked={s(r.get('linked'))!r}")
print(f"\n=== CHAMP 'index' (valeurs) ===")
print("  ", Counter(s(r.get('index')) for r in bi).most_common(8))

# MULTI-FACTURE : events avec plusieurs factures non-avoir (revisions ou multi-devis ?)
multi_fac = {e: v for e, v in by_event.items() if sum(1 for d in v if dtype(d) == "facture") >= 2}
print(f"\n=== EVENTS AVEC >=2 FACTURES (revision / multi-devis ?) : {len(multi_fac)} ===")
for e, v in list(multi_fac.items())[:3]:
    print(f"\n  event {e}  (total event paye+attente = {round((dec(ev.get(e,{}).get('amount_paid')) or 0)+(dec(ev.get(e,{}).get('amount_waiting')) or 0))}):")
    for d in sorted(v, key=lambda x: s(x.get('creationDate')) or ''):
        print(f"    {dtype(d):14} name={s(d.get('name'))!s:22} ttc={dec(d.get('amountTTC'))!s:>9} statut={s(d.get('invoice_status'))!s:10} cree={s(d.get('creationDate'))} index={s(d.get('index'))}")

# AVOIRS : que valent-ils vs les docs positifs du meme event ?
AVOIR = {"acompte-avoir", "solde-avoir", "facture-avoir"}
ev_avoir = {e: v for e, v in by_event.items() if any(dtype(d) in AVOIR for d in v)}
print(f"\n=== EVENTS AVEC AVOIR (annulation/correction) : {len(ev_avoir)} ===")
for e, v in list(ev_avoir.items())[:3]:
    pos = round(sum(dec(d.get('amountTTC')) or 0 for d in v if dtype(d) not in AVOIR), 2)
    neg = round(sum(dec(d.get('amountTTC')) or 0 for d in v if dtype(d) in AVOIR), 2)
    print(f"\n  event {e}: positifs={pos} avoirs={neg} net={round(pos+neg,2)} | event_total={round((dec(ev.get(e,{}).get('amount_paid')) or 0)+(dec(ev.get(e,{}).get('amount_waiting')) or 0))}")
    for d in sorted(v, key=lambda x: s(x.get('creationDate')) or ''):
        print(f"    {dtype(d):14} ttc={dec(d.get('amountTTC'))!s:>10} name={s(d.get('name'))!s:22} statut={s(d.get('invoice_status'))}")

# Comparaison cle : event_total (amount_paid+waiting) vs somme des docs, par profil
print(f"\n=== EVENT_TOTAL vs DOCS (pourquoi ca diverge) ===")
prof = Counter()
for e, v in by_event.items():
    et = round((dec(ev.get(e,{}).get('amount_paid')) or 0)+(dec(ev.get(e,{}).get('amount_waiting')) or 0))
    fac = round(sum(dec(d.get('amountTTC')) or 0 for d in v if dtype(d)=="facture"), 2)
    sol = round(sum(dec(d.get('amountTTC')) or 0 for d in v if dtype(d)=="solde"), 2)
    aco = round(sum(dec(d.get('amountTTC')) or 0 for d in v if dtype(d)=="acompte"), 2)
    avo = round(sum(dec(d.get('amountTTC')) or 0 for d in v if dtype(d) in AVOIR), 2)
    def near(a,b): return b and abs(a-b)<=max(2,0.02*abs(b))
    if near(et, fac): prof["event_total == facture"] += 1
    elif near(et, fac+sol): prof["event_total == facture+solde"] += 1
    elif near(et, aco+sol): prof["event_total == acompte+solde"] += 1
    elif near(et, fac+sol+avo): prof["event_total == net (avoirs deduits)"] += 1
    elif et and not (fac or sol): prof["event_total mais AUCUN doc facture/solde"] += 1
    else: prof["autre / ne colle a aucune combinaison"] += 1
for k,n in prof.most_common():
    print(f"  {n:>5}  {k}")
