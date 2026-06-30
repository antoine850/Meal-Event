"""Debug (lecture seule) : pour les 276 placeholder-avec-PDF, compare la somme des lignes
PARSEES au TOTAL DU DEVIS STOCKE (la cible reelle de phase6). Candidats = chaque doc + l'union.
Classe : enrichissable (match), a 1 cheveu (loosen tol), lignes trop courtes (detail source
manquant), lignes trop hautes, ou PDF illisible."""
import sys, json, glob
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, ".")
from lib import load_csv, BILLING_CSV, s, dec
import phase4_enrich_dryrun as p4

limit = next((int(a.split("=",1)[1]) for a in sys.argv if a.startswith("--limit=")), None)
redo = json.loads(open(sorted(glob.glob("backups/enrich_redo_candidates_*.json"))[-1]).read())
if limit: redo = redo[:limit]
target = {r["event_id"] for r in redo}
stored = {r["event_id"]: r["total_ttc"] for r in redo}
bi = load_csv(BILLING_CSV)
bill_by_event = defaultdict(list)
for r in bi:
    eid = s(r.get("event_id"))
    if eid in target: bill_by_event[eid].append(r)

def line_ok(it):
    ht,ttc,tva=it["total_ht"] or 0,it["total_ttc"] or 0,it["tva_rate"] or 0
    return abs(ht*(1+tva/100)-ttc)<=max(0.05,0.01*abs(ttc))

def diagnose(eid):
    st=stored.get(eid) or 0
    docs=[d for d in bill_by_event.get(eid,[]) if p4.dtype(d) in ("facture","solde") and s(d.get("url"))]
    out={"eid":eid,"stage":None,"detail":"","st":st}
    parsed=[]; nohdr=False
    for d in docs:
        try: txt=p4.pdftext(p4.download(s(d.get("url"))))
        except Exception as e: out["stage"]="download_err"; out["detail"]=str(e)[:60]; return out
        items,ok=p4.parse_lines(txt)
        if not ok:
            nohdr=nohdr or not any(("DÉSIGNATION" in x and "QUANTITÉ" in x) for x in txt.splitlines()); continue
        parsed.append((items, round(sum((i["total_ttc"] or 0) for i in items),2)))
    if not parsed:
        out["stage"]="table_not_found" if nohdr else "parsed_0_lines"; return out
    # dedup docs identiques
    seen,uniq=set(),[]
    for items,sm in parsed:
        sig=tuple(sorted((i["name"],i["total_ttc"]) for i in items))
        if sig not in seen: seen.add(sig); uniq.append((items,sm))
    union=[i for items,_ in uniq for i in items]
    cands=uniq+[(union, round(sum((i["total_ttc"] or 0) for i in union),2))]
    # candidat dont la somme est la plus proche du total devis stocke
    items,sm=min(cands, key=lambda c: abs(c[1]-st))
    out["nlines"]=len(items); out["sum"]=sm
    coh=all(line_ok(it) for it in items)
    diff=abs(sm-st)
    if diff<=1.0 and coh: out["stage"]="ENRICHISSABLE (match exact)"
    elif diff<=max(2.0,0.02*st) and coh: out["stage"]="A 1 CHEVEU (loosen tol <=2%)"
    elif sm < st*0.9: out["stage"]="LIGNES TROP COURTES (detail source manquant)"
    elif sm > st*1.1: out["stage"]="LIGNES TROP HAUTES"
    elif not coh: out["stage"]="LIGNE INCOHERENTE (HT*(1+tva)!=TTC)"
    else: out["stage"]="ecart moyen"
    out["detail"]=f"lignes={sm} vs devis={st} ({len(items)} l, coh={coh})"
    return out

eids=[x["event_id"] for x in redo]
print(f"diagnostic sur {len(eids)} events (cible = total devis stocke)...")
with ThreadPoolExecutor(max_workers=12) as ex:
    res=list(ex.map(diagnose,eids))
st=Counter(x["stage"] for x in res)
print("\n=== CAN-ON-ENRICHIR ? (somme lignes PDF vs total devis STOCKE) ===")
for k,n in st.most_common(): print(f"  {n:>4}  {k}")
enrich=[x for x in res if x["stage"].startswith(("ENRICHISSABLE","A 1 CHEVEU"))]
short=[x for x in res if "TROP COURTES" in x["stage"]]
print(f"\n  => directement ou presque enrichissables: {len(enrich)}")
print(f"  => bloques par detail source manquant (lignes < devis): {len(short)}")
print("\n  -- echantillon enrichissables --")
for x in enrich[:8]: print(f"     {x['eid']}: {x['detail']}")
print("\n  -- echantillon lignes trop courtes (event gonfle vs facture) --")
for x in short[:8]: print(f"     {x['eid']}: {x['detail']}")
out=f"backups/enrich_diagnostic_{__import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
open(out,"w").write(json.dumps(res,ensure_ascii=False,indent=1))
print(f"\n  detail complet: {out}")
