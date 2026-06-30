"""Read-only diagnostic: quantifie les ecarts d'arrondi sur quotes/quote_items/payments.
Replique exactement les regles TS (quote-rounding.ts, price.ts). Aucune ecriture."""
import sys, math, json, urllib.request
from collections import Counter, defaultdict
sys.path.insert(0, ".")
from lib import load_env

url, key, _ = load_env()
H = {"apikey": key, "Authorization": f"Bearer {key}"}

def get_all(table, select):
    out, off, page = [], 0, 1000
    while True:
        q = f"{url}/rest/v1/{table}?select={select}&limit={page}&offset={off}&order=id"
        req = urllib.request.Request(q, headers=H)
        with urllib.request.urlopen(req, timeout=120) as r:
            chunk = json.loads(r.read().decode())
        out.extend(chunk)
        if len(chunk) < page:
            return out
        off += page

quotes = get_all("quotes", "id,organization_id,external_source,total_ht,total_tva,total_ttc,discount_percentage,discount_amount,status")
items = get_all("quote_items", "quote_id,quantity,unit_price,tva_rate,discount_amount,total_ht,total_ttc,item_type,external_source")
pays = get_all("payments", "quote_id,amount,status,external_source")
print(f"loaded quotes={len(quotes)} items={len(items)} payments={len(pays)}")

# --- replication exacte des regles TS ---
def round_line_ttc(qty, price, disc, tva):
    raw = ((qty or 0)*(price or 0) - (disc or 0)) * (1 + (tva or 0)/100)
    return math.ceil(raw), raw

def derive_line_ht(ttc, tva):
    rate = tva or 0
    if rate <= -100: return 0
    return ttc / (1 + rate/100)

def derive_ht_floor(ttc, tva):  # price.ts deriveHtFromTtc
    rate = tva or 0
    if rate <= -100: return 0
    return math.floor((ttc/(1+rate/100))*100 + 1e-9)/100

by_quote = defaultdict(list)
for it in items:
    by_quote[it["quote_id"]].append(it)

def is_bs(src): return src == "booking_shake"

# ---------- LINE-LEVEL ----------
line_stats = {"bs": Counter(), "app": Counter()}
amp_examples = []
tva_rates = Counter()
line_ht_mismatch = {"bs": 0, "app": 0}
line_recompute_mismatch = {"bs": 0, "app": 0}
line_recompute_delta = []
for it in items:
    if it.get("item_type") == "extra":
        continue
    k = "bs" if is_bs(it.get("external_source")) else "app"
    qty, price, disc, tva = it.get("quantity"), it.get("unit_price"), it.get("discount_amount"), it.get("tva_rate")
    stored_ttc = it.get("total_ttc") or 0
    stored_ht = it.get("total_ht") or 0
    tva_rates[tva] += 1
    ceil_ttc, raw = round_line_ttc(qty, price, disc, tva)
    frac = raw - math.floor(raw)
    # amplification: ceil bumps presque un euro entier (raw juste au-dessus d'un entier)
    if 0 < frac <= 0.02:
        line_stats[k]["amp_tiny_frac"] += 1
        if len(amp_examples) < 12:
            amp_examples.append({"src":k,"qty":qty,"unit_price":price,"tva":tva,"raw":round(raw,4),
                                 "ceil":ceil_ttc,"stored_ttc":stored_ttc,"overcharge":round(ceil_ttc-raw,4)})
    # recompute drift vs stored
    if abs(ceil_ttc - stored_ttc) > 0.001:
        line_recompute_mismatch[k] += 1
        line_recompute_delta.append(ceil_ttc - stored_ttc)
    # HT internal consistency: stored_ht*(1+tva) doit ~ stored_ttc
    if abs(stored_ht*(1+(tva or 0)/100) - stored_ttc) > 0.01:
        line_ht_mismatch[k] += 1
    # ceil overcharge moyen vs raw (combien l'arrondi euro coute par ligne)
    line_stats[k]["overcharge_sum_cents"] += round((ceil_ttc - raw)*100)
    line_stats[k]["count"] += 1

# ---------- HEADER vs LINES ----------
def compute_quote_totals(prod_items, disc_pct):
    mult = 1 - (disc_pct or 0)/100 if (disc_pct or 0) > 0 else 1
    raw_ttc = raw_ht = 0
    for it in prod_items:
        ceil_ttc, _ = round_line_ttc(it.get("quantity"), it.get("unit_price"), it.get("discount_amount"), it.get("tva_rate"))
        raw_ttc += ceil_ttc
        raw_ht += derive_line_ht(ceil_ttc, it.get("tva_rate"))
    total_ttc = math.ceil(raw_ttc*mult)
    total_ht = raw_ht*mult
    return total_ht, total_ttc - total_ht, total_ttc

hdr = {"bs": Counter(), "app": Counter()}
hdr_delta = {"bs": [], "app": []}
vat_identity_bad = {"bs": 0, "app": 0}
lines_vs_header_bad = {"bs": 0, "app": 0}
hdr_examples = []
for q in quotes:
    k = "bs" if is_bs(q.get("external_source")) else "app"
    hdr[k]["count"] += 1
    prod = [it for it in by_quote.get(q["id"], []) if it.get("item_type") != "extra"]
    sttc = q.get("total_ttc") or 0
    sht = q.get("total_ht") or 0
    stva = q.get("total_tva") or 0
    # VAT identity ht+tva==ttc
    if abs(sht + stva - sttc) > 0.01:
        vat_identity_bad[k] += 1
    if not prod:
        continue
    rht, rtva, rttc = compute_quote_totals(prod, q.get("discount_percentage"))
    if abs(rttc - sttc) > 0.01:
        lines_vs_header_bad[k] += 1
        hdr_delta[k].append(rttc - sttc)
        if len(hdr_examples) < 12:
            hdr_examples.append({"src":k,"stored_ttc":sttc,"recomputed_ttc":rttc,"delta":round(rttc-sttc,2),
                                 "n_lines":len(prod),"disc_pct":q.get("discount_percentage")})

# ---------- PAYMENTS ----------
paid_by_quote = defaultdict(float)
for p in pays:
    if (p.get("status") in ("paid","completed")) and p.get("quote_id"):
        paid_by_quote[p["quote_id"]] += p.get("amount") or 0
frac_balance = 0
overpaid = 0
for q in quotes:
    sttc = q.get("total_ttc") or 0
    paid = paid_by_quote.get(q["id"], 0)
    rem = sttc - paid
    if abs(rem - round(rem)) > 0.005 and abs(rem) > 0.005:
        frac_balance += 1
    if paid - sttc > 0.01:
        overpaid += 1

# ---------- REPORT ----------
def pct(n, d): return f"{n} ({100*n/d:.1f}%)" if d else str(n)
print("\n===== LINE-LEVEL (product items only) =====")
for k in ("bs","app"):
    c = line_stats[k]; tot = c["count"]
    print(f"\n[{k}] product lines: {tot}")
    if not tot: continue
    print(f"  recompute drift (stored_ttc != ceil rule): {pct(line_recompute_mismatch[k], tot)}")
    print(f"  amplification (0<frac<=0.02 -> ceil bumps ~1 euro): {pct(c['amp_tiny_frac'], tot)}")
    print(f"  HT inconsistent (stored_ht*(1+tva) != stored_ttc >0.01): {pct(line_ht_mismatch[k], tot)}")
    print(f"  total ceil-overcharge vs raw: {c['overcharge_sum_cents']/100:.2f} EUR  (avg {c['overcharge_sum_cents']/tot:.1f} cents/line)")

print("\n  tva_rate distribution:", tva_rates.most_common())
print("\n  amplification examples:")
for e in amp_examples: print("   ", e)
if line_recompute_delta:
    import statistics as st
    print(f"\n  recompute delta euros: n={len(line_recompute_delta)} sum={sum(line_recompute_delta):.2f} "
          f"min={min(line_recompute_delta):.2f} max={max(line_recompute_delta):.2f}")

print("\n===== HEADER vs LINES =====")
for k in ("bs","app"):
    tot = hdr[k]["count"]
    print(f"\n[{k}] quotes: {tot}")
    print(f"  VAT identity bad (ht+tva != ttc >0.01): {pct(vat_identity_bad[k], tot)}")
    print(f"  header total_ttc != recomputed-from-lines: {pct(lines_vs_header_bad[k], tot)}")
    if hdr_delta[k]:
        print(f"  delta euros: sum={sum(hdr_delta[k]):.2f} min={min(hdr_delta[k]):.2f} max={max(hdr_delta[k]):.2f}")
print("\n  header examples:")
for e in hdr_examples: print("   ", e)

print("\n===== PAYMENTS =====")
print(f"  quotes with fractional-cent remaining balance: {frac_balance}")
print(f"  quotes overpaid (paid > total_ttc +0.01): {overpaid}")
