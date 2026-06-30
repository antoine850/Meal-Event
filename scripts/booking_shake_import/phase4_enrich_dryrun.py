"""Phase 4 (DRY-RUN) -- enrichit les devis BS importes a partir des PDF de facture.
Lecture seule : telecharge les PDF (token Firebase permanent), extrait le texte (pdftotext),
parse les lignes du tableau, recupere le vrai acompte% et la ventilation TVA (CSV), et produit
un rapport de ce qui SERAIT ecrit. N'ecrit rien. Necessite `pdftotext` (poppler).

Perimetre (decide avec le client) :
  - lignes reelles pour les events avec doc facture/solde (detail produits),
  - ventilation TVA juste depuis le CSV (TVA10/TVA20/...) pour les events factures,
  - vrai deposit_percentage depuis le PDF acompte,
  - lignes en texte libre (pas de lien catalogue products).
  - les ~1130 devis synthetiques (sans facture) ne sont pas touches.

Usage : python3 scripts/booking_shake_import/phase4_enrich_dryrun.py [--limit N] [--events=ID,ID]
"""
import json, re, subprocess, sys, tempfile, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from lib import load_csv, s, dec, BILLING_CSV, EVENTS_CSV, arg_events, section, line

CACHE = Path(tempfile.gettempdir()) / "bs_pdf_cache"
CACHE.mkdir(exist_ok=True)

# doc types qui portent le detail produit (vs acompte = simple renvoi au devis)
DETAIL_TYPES = ("facture", "solde", "facture-avoir", "solde-avoir")
TVA_BUCKETS = [("HT10", "TVA10", 10), ("HT20", "TVA20", 20), ("HT0", "TVA0", 0),
               ("HT22", "TVA22", 22), ("HT200", "TVA200", 20)]

# une ligne produit : <designation> <qty> <pu> € <ht> € <ttc> € [<tva>%]
# le TVA% est optionnel (2e gabarit de tableau sans colonne TVA) -> recalcule depuis HT/TTC.
LINE_RE = re.compile(
    r"^(?P<desig>.+?)\s{2,}(?P<qty>\d+)\s+(?P<pu>[\d  .,]+?)\s*€\s+"
    r"(?P<ht>[\d  .,]+?)\s*€\s+(?P<ttc>[\d  .,]+?)\s*€(?:\s+(?P<tva>\d+)\s*%)?"
)
DEVIS_PCT_RE = re.compile(r"devis n[°o]\s*([A-Za-z0-9\-]+)\s*\((\d+)\s*%\)")
DATE_HDR_RE = re.compile(r"^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\b", re.I)


def dtype(d):
    return (s(d.get("type")) or "facture").lower()


def num(v):
    return dec(v)


def download(url):
    key = re.sub(r"[^A-Za-z0-9]", "_", url)[-80:]
    f = CACHE / f"{key}.pdf"
    if not f.exists() or f.stat().st_size == 0:
        f.write_bytes(urllib.request.urlopen(url, timeout=40).read())
    return f


def pdftext(path):
    return subprocess.run(["pdftotext", "-layout", str(path), "-"],
                          capture_output=True, text=True).stdout


def parse_lines(txt):
    """Retourne (lignes, ok) ou ok=False si le tableau detaille n'a pas ete trouve."""
    rows = txt.splitlines()
    start = next((i for i, r in enumerate(rows) if "DÉSIGNATION" in r and "QUANTITÉ" in r), None)
    if start is None:
        return [], False
    items = []
    for r in rows[start + 1:]:
        t = r.strip()
        if not t:
            continue
        if t.startswith(("Total HT", "Total TTC", "Coordonnées bancaires", "Sous-total")):
            break
        # Recap TVA / remise dans le corps du tableau : non-produit. On saute la ligne
        # sans arreter le parsing (l'ancien break sur "TVA " coupait tout le reste).
        if t.startswith(("TVA à", "TVA ", "Remise")):
            continue
        m = LINE_RE.match(r)
        if m:
            ht, ttc = num(m.group("ht")), num(m.group("ttc"))
            tva = int(m.group("tva")) if m.group("tva") else (
                round((ttc / ht - 1) * 100) if ht else 0)
            items.append({
                "name": re.sub(r"\s+", " ", m.group("desig")).strip(),
                "description": "",
                "quantity": int(m.group("qty")),
                "unit_price": num(m.group("pu")),
                "total_ht": ht,
                "total_ttc": ttc,
                "tva_rate": tva,
            })
        elif DATE_HDR_RE.match(t):
            continue  # sous-en-tete de date
        elif items and not any(ch.isdigit() for ch in t):
            d = items[-1]["description"]
            items[-1]["description"] = (d + " " + t).strip()
    return items, bool(items)


def agg_tva(docs):
    out = []
    for ht_k, tva_k, rate in TVA_BUCKETS:
        ht = round(sum(dec(d.get(ht_k)) or 0 for d in docs), 2)
        tva = round(sum(dec(d.get(tva_k)) or 0 for d in docs), 2)
        if ht or tva:
            out.append({"rate": rate, "ht": ht, "tva": tva})
    return out


def main():
    events = arg_events()
    limit = next((int(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--limit=")), None)
    rows = load_csv(BILLING_CSV)
    ev_total = {s(e.get("event_id")): round((dec(e.get("amount_paid")) or 0) + (dec(e.get("amount_waiting")) or 0))
                for e in load_csv(EVENTS_CSV) if s(e.get("event_id"))}

    by_event = defaultdict(list)
    for r in rows:
        eid = s(r.get("event_id"))
        if eid and (not events or eid in events):
            by_event[eid].append(r)

    targets = list(by_event.items())
    if limit:
        targets = targets[:limit]

    def reconciles_val(total, tgt):
        return tgt and total is not None and abs(total - tgt) <= max(2.0, 0.02 * tgt)

    # telechargement + extraction (parallele, lecture seule)
    def work(t):
        eid, docs = t
        tgt = ev_total.get(eid)
        res = {"eid": eid, "n_docs": len(docs), "items": [], "parsed": False,
               "deposit_pct": None, "tva": [], "doc_type": None, "sum_ttc": None,
               "event_total": tgt, "source": None, "err": None}
        try:
            acompte = next((d for d in docs if dtype(d) == "acompte"), None)
            if acompte:
                m = DEVIS_PCT_RE.search(pdftext(download(s(acompte.get("url")))))
                if m:
                    res["deposit_pct"] = int(m.group(2))
            # parse chaque doc de detail (non-avoir) ; TVA agregee depuis le CSV
            details = [d for d in docs if dtype(d) in ("facture", "solde")]
            if not details:
                return res
            parsed = []
            for d in details:
                its, ok = parse_lines(pdftext(download(s(d.get("url")))))
                if ok:
                    parsed.append((d, its, round(sum((i["total_ttc"] or 0) for i in its), 2)))
            if not parsed:
                res["doc_type"] = dtype(details[0])
                return res
            # dedup des docs au contenu identique (meme solde emis 2x)
            seen, uniq = set(), []
            for d, its, sm in parsed:
                sig = tuple(sorted((i["name"], i["total_ttc"]) for i in its))
                if sig not in seen:
                    seen.add(sig); uniq.append((d, its, sm))
            # candidats : chaque doc seul (prefere facture, puis le + complet) + union des docs distincts
            singles = sorted(uniq, key=lambda x: (0 if dtype(x[0]) == "facture" else 1, -x[2]))
            union_docs = [d for d, _, _ in uniq]
            union_items = [i for _, its, _ in uniq for i in its]
            union_sum = round(sum((i["total_ttc"] or 0) for i in union_items), 2)
            cands = [("single", dtype(d), its, sm, [d]) for d, its, sm in singles]
            cands.append(("union", "multi", union_items, union_sum, union_docs))
            pick = next((c for c in cands if reconciles_val(c[3], tgt)), cands[0])
            res["source"], res["doc_type"], res["items"], res["sum_ttc"] = pick[0], pick[1], pick[2], pick[3]
            res["tva"] = agg_tva(pick[4])
            res["parsed"] = True
        except Exception as e:
            res["err"] = str(e)[:120]
        return res

    section("PHASE 4 -- ENRICHISSEMENT DEVIS (DRY-RUN, lecture seule)")
    print(f"  events factures cibles : {len(targets)} (telechargement + parsing en cours...)\n")
    with ThreadPoolExecutor(max_workers=10) as ex:
        results = list(ex.map(work, targets))

    # cohérence interne par ligne : HT*(1+TVA) == TTC (robuste, insensible aux remises)
    # et qty*PU == TTC (informatif : échoue légitimement sur les lignes offertes/remisées).
    def line_ok_tva(it):
        ht, ttc, tva = it["total_ht"] or 0, it["total_ttc"] or 0, it["tva_rate"] or 0
        return abs(ht * (1 + tva / 100) - ttc) <= max(0.05, 0.01 * abs(ttc))
    def line_ok_mult(it):
        pu, qty, ttc = it["unit_price"] or 0, it["quantity"] or 0, it["total_ttc"] or 0
        return abs(pu * qty - ttc) <= max(0.05, 0.01 * abs(ttc))
    all_items = [(r, it) for r in results if r["parsed"] for it in r["items"]]
    bad_tva = [(r, it) for r, it in all_items if not line_ok_tva(it)]
    bad_mult = [(r, it) for r, it in all_items if not line_ok_mult(it)]
    clean_events = [r for r in results if r["parsed"] and r["items"]
                    and all(line_ok_tva(it) for it in r["items"])]

    has_detail = [r for r in results if r["doc_type"]]
    parsed = [r for r in has_detail if r["parsed"]]
    failed = [r for r in has_detail if not r["parsed"] and not r["err"]]
    errs = [r for r in results if r["err"]]
    acompte_only = [r for r in results if not r["doc_type"]]
    n_lines = sum(len(r["items"]) for r in parsed)
    pct_ok = [r for r in results if r["deposit_pct"] is not None]

    # reconciliation : somme des lignes vs TOTAL de l'event (= quote.total_ttc).
    # tolerance 2% (arrondis BS) ; le solde liste tout l'event, pas seulement le solde.
    def reconciles(r):
        tgt = r["event_total"]
        return tgt and r["sum_ttc"] is not None and abs(r["sum_ttc"] - tgt) <= max(2.0, 0.02 * tgt)
    recon_ok = [r for r in parsed if reconciles(r)]
    recon_bad = [r for r in parsed if not reconciles(r) and r["event_total"]]

    line("events avec doc detaille (facture/solde)", len(has_detail))
    line("  -> lignes parsees OK", f"{len(parsed)}  ({n_lines} lignes au total)")
    line("  -> tableau present mais 0 ligne extraite", len(failed))
    line("  -> reconciliation somme lignes == total event", f"{len(recon_ok)} / {len(parsed)}")
    line("  -> ecart de reconciliation (> 2%)", len(recon_bad))
    line("events acompte-seul (pas de detail)", len(acompte_only))
    line("deposit_percentage reel extrait", f"{len(pct_ok)} / {len(results)}")
    line("erreurs telechargement/extraction", len(errs))

    section("COHERENCE INTERNE DES LIGNES")
    line("lignes totales verifiees", len(all_items))
    line("  HT*(1+TVA) == TTC  (echecs)", f"{len(all_items) - len(bad_tva)} OK / {len(bad_tva)} KO")
    line("  qty*PU == TTC      (echecs, dont offerts/remises)", f"{len(all_items) - len(bad_mult)} OK / {len(bad_mult)} KO")
    line("events dont TOUTES les lignes passent TVA", len(clean_events))
    line(">> events FIABLES (reconcilient ET lignes coherentes)",
         len([r for r in recon_ok if r in clean_events]))
    if bad_tva:
        print("\n  -- lignes HT*(1+TVA) != TTC (a inspecter) --")
        for r, it in bad_tva[:8]:
            print(f"      {r['eid']}: {it['name'][:30]:30} HT={it['total_ht']} TVA={it['tva_rate']}% TTC={it['total_ttc']}")

    print("\n  -- echantillon de 3 devis parses --")
    for r in parsed[:3]:
        print(f"\n  event {r['eid']}  ({r['doc_type']}/{r['source']}, {len(r['items'])} lignes, "
              f"somme {r['sum_ttc']} / event {r['event_total']}, acompte {r['deposit_pct']}%)")
        for it in r["items"][:6]:
            d = f"  | {it['description'][:40]}" if it["description"] else ""
            print(f"      {it['quantity']:>3} x {it['name'][:34]:34} {it['total_ttc']:>9} TTC  {it['tva_rate']}%{d}")
        if r["tva"]:
            print("      TVA:", ", ".join(f"{b['rate']}%={b['tva']}" for b in r["tva"]))

    if recon_bad:
        print("\n  -- echantillon d'ecarts de reconciliation --")
        for r in recon_bad[:8]:
            print(f"      {r['eid']}: somme lignes {r['sum_ttc']} vs event {r['event_total']} ({r['doc_type']}/{r['source']}, {r['n_docs']} docs)")
    if failed:
        print("\n  -- events ou le parsing a rate (a inspecter) --")
        for r in failed[:8]:
            print(f"      {r['eid']} ({r['doc_type']})")

    out = Path(tempfile.gettempdir()) / "bs_enrich_dryrun.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=1))
    print(f"\n  resultats complets ecrits dans {out} (inspection, AUCUNE ecriture prod)")


if __name__ == "__main__":
    main()
