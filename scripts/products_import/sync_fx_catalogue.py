"""Synchro du catalogue produits depuis le fichier de FX (Template_produits_MealEvent_rempli.xlsx).

Regles actees les 04 et 10/09 (Thomas + FX) :
  - Le fichier est la reference pour les produits qu'il cite ; ses libelles remplacent les
    anciens (familles RENAMES). Cle de rapprochement = nom normalise + type, puis restos.
  - Un resto lie en base mais absent du fichier garde sa liaison ET son prix : si le fichier
    change le prix ou la TVA, le produit est scinde (clone aux anciennes valeurs pour les
    restos non cites, nouveau nom).
  - Hangar Y = Mlle Celeste (renomme le 31/08). Par personne : le fichier gagne.
  - Prosecco : 10 EUR partout (FX 10/09), les 12 EUR du fichier sont ignores.
  - "Formule aperitif/aperitive" -> "Formule aperitive - 3 pieces". Menus adultes sans mention
    de boisson -> "eaux & cafes inclus" ajoute a la description.
  - Suppressions FX : Formule cocktail Aperitivo ; Menu Afterwork / Formule Afterwork absorbes
    par "Afterwork - 5 pieces".
  - Menage base : doublons (nom+type+memes restos) tranches seulement quand c'est evident
    (meme prix, ou un seul prix non nul), les autres sont listes pour FX ; orphelins sans
    resto -> desactives ; espaces parasites dans les noms -> nettoyes.
  - Rien n'est supprime : desactivation seulement. Les devis copient le prix a l'insertion,
    aucun devis existant ne bouge.
Hors perimetre, a confirmer avec FX : libelles des menus dejeuner, "Cocktail au litre" et
"Mocktail au litre" (restos inconnus).
Dry-run par defaut ; --apply ecrit un backup JSON (produits + liaisons touches) puis execute.
Relancer en dry-run apres apply doit donner 0 action."""
import re, sys, json, unicodedata, collections, warnings
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "booking_shake_import"))
from lib import load_env, Supa, ORG_ID, section, line

warnings.filterwarnings("ignore")
import pandas as pd

HERE = Path(__file__).resolve().parent
BACKUP_DIR = HERE / "backups"
XLSX = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--xlsx=")),
            "/Users/thomas/Downloads/Template_produits_MealEvent_rempli.xlsx")
apply = "--apply" in sys.argv
db = Supa(*load_env()[:2])

TYPE = {"Boissons alcoolisées": "boissons_alcoolisees", "Boissons sans alcool": "boissons_sans_alcool",
        "Food": "food", "Frais de personnel": "frais_personnel", "Frais de privatisation": "frais_privatisation",
        "Prestataires": "prestataires"}
TAG = {v: k for k, v in TYPE.items()}
RESTO_ALIAS = {"Hangar Y": "Mlle Céleste"}

# libelle base (forme relachee) -> libelle FX
RENAMES = [
    (re.compile(r"^cocktail (\d+) pi[eè]ces?$"), lambda m: f"Cocktail dînatoire - {m.group(1)} pièces"),
    (re.compile(r"^coupe de champagne prestige$"), lambda m: "Coupe de champagne premium"),
    (re.compile(r"^coupe de champagne greno maison pommery$"), lambda m: "Coupe de champagne - sélection maison"),
    (re.compile(r"^menu de tata$"), lambda m: "Menu Tata"),
    (re.compile(r"^menu formule compl[eè]te$"), lambda m: "Formule Complète Déjeuner"),
    (re.compile(r"^(menu|formule) afterwork$"), lambda m: "Afterwork - 5 pièces"),
    (re.compile(r"^coupe doc prosecco$"), lambda m: "Coupe de Prosecco"),
]
# produits que FX supprime (desactivation), forme relachee
DEACTIVATE_NAMES = {"formule cocktail aperitivo"}
DRINK_WORDS = ("eau", "café", "cafe", "boisson", "soft", "sirop", "champagne", "kir", "vin")


def norm(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace("’", "'").replace("‘", "'").replace("–", "-").replace("—", "-").replace("‐", "-")
    s = re.sub(r"\s*-\s*", " - ", s)
    return re.sub(r"\s+", " ", s).strip()


def loose(s):
    return re.sub(r"[^a-z0-9]+", " ", norm(s)).strip()


def canonical(name):
    l = loose(name)
    for rx, fn in RENAMES:
        m = rx.match(l)
        if m:
            return fn(m)
    return name


def ht(ttc, tva):
    return float((Decimal(str(ttc)) / (1 + Decimal(str(tva)) / 100)).quantize(Decimal("0.01"), ROUND_HALF_UP))


def clean_name(n):
    return re.sub(r"\s+", " ", n).strip()


# ---------------------------------------------------------------- base
restos = db.get_all("restaurants", "id,name", f"organization_id=eq.{ORG_ID}")
name2id = {r["name"]: r["id"] for r in restos}
id2name = {v: k for k, v in name2id.items()}
prods = db.get_all("products", "*", f"organization_id=eq.{ORG_ID}")
links = db.get_all("product_restaurants", "id,product_id,restaurant_id")
restos_of = collections.defaultdict(set)
for l in links:
    restos_of[l["product_id"]].add(l["restaurant_id"])
by_id = {p["id"]: p for p in prods}
by_key = collections.defaultdict(list)
for p in prods:
    p["restos"] = restos_of.get(p["id"], set())
    p["key"] = (norm(canonical(p["name"])), p["type"])
    by_key[p["key"]].append(p)
names = lambda ids: ", ".join(sorted(id2name[x] for x in ids))

# ---------------------------------------------------------------- fichier
df = pd.read_excel(XLSX, sheet_name="Produits").dropna(how="all")
df.columns = ["nom", "type", "description", "restaurants", "par_personne", "mode", "prix", "tva",
              "prix_ht", "prix_ttc", "marge", "actif"]
rows, sig_index = [], {}
for i, r in enumerate(df.to_dict("records"), start=2):
    nom, typ = clean_name(str(r["nom"])), TYPE[r["type"]]
    desc, ttc = clean_name(str(r["description"] or "")).replace("nan", ""), float(r["prix"])
    if loose(nom) in ("formule aperitif", "formule aperitive"):
        nom = "Formule apéritive - 3 pièces"
    if loose(nom) == "coupe de prosecco":
        ttc = 10.0
    if typ == "food" and loose(nom).startswith("menu") and "entr" in desc.lower() \
            and "sans" not in desc.lower() and not any(w in desc.lower() for w in DRINK_WORDS):
        desc = desc.rstrip(".") + ", eaux & cafés inclus."
    R = {name2id[RESTO_ALIAS.get(x.strip(), x.strip())] for x in str(r["restaurants"]).split(";")}
    sig = (norm(nom), typ, ttc, float(r["tva"]), r["par_personne"] == "Oui", desc)
    if sig in sig_index:            # meme produit, meme prix, restos differents : une seule ligne
        rows[sig_index[sig]]["restos"] |= R
        continue
    sig_index[sig] = len(rows)
    rows.append({"xl": i, "nom": nom, "type": typ, "desc": desc, "ttc": ttc, "tva": float(r["tva"]),
                 "pp": r["par_personne"] == "Oui", "restos": R, "key": (norm(nom), typ)})

claimed = collections.defaultdict(set)
for row in rows:
    claimed[row["key"]] |= row["restos"]

# home : appariement glouton ligne <-> produit existant, plus grand recouvrement de restos
# d'abord, prix egal ensuite, ordre du fichier enfin. Un produit ne sert qu'une ligne.
pairs = []
for i, row in enumerate(rows):
    for p in by_key.get(row["key"], []):
        n = len(p["restos"] & row["restos"])
        if n:
            pairs.append((-n, abs((p["unit_price_ttc"] or 0) - row["ttc"]) > 0.005, i, p["id"]))
home, taken = {}, set()
for _, _, i, pid in sorted(pairs):
    if i not in home and pid not in taken:
        home[i] = pid
        taken.add(pid)

# ---------------------------------------------------------------- plan
updates, final, creates, deactivate, log = {}, {}, [], {}, []


def fields(row):
    return {"name": row["nom"], "description": row["desc"] or None, "unit_price_ttc": row["ttc"],
            "unit_price_ht": ht(row["ttc"], row["tva"]), "tva_rate": row["tva"], "price_entry_mode": "ttc",
            "price_per_person": row["pp"], "tag": TAG[row["type"]]}


def changed(p, f):
    out = []
    for k, v in f.items():
        cur = p.get(k)
        if k in ("unit_price_ttc", "unit_price_ht", "tva_rate"):
            if abs((cur or 0) - v) > 0.005:
                out.append(f"{k} {cur} -> {v}")
        elif (cur or None) != (v or None) and not (k == "description" and (cur or "").strip() == (v or "").strip()):
            out.append(f"{k}: {cur!r} -> {v!r}" if k == "name" else k)
    return out


for i, row in enumerate(rows):
    R, f = row["restos"], fields(row)
    if i in home:
        p = by_id[home[i]]
        kept = p["restos"] - claimed[row["key"]]
        diff = changed(p, f)
        values_change = any(d.split()[0] in ("unit_price_ttc", "tva_rate") for d in diff)
        if kept and values_change:
            # scission : les restos non cites gardent les anciennes valeurs sous le nouveau nom
            clone = {k: p[k] for k in ("type", "description", "unit_price_ht", "unit_price_ttc", "tva_rate",
                                       "price_entry_mode", "price_per_person", "margin")}
            clone.update({"name": row["nom"], "tag": TAG[row["type"]], "restos": kept, "why": f"scission de '{p['name']}' ({p['unit_price_ttc']} EUR) pour {names(kept)}"})
            creates.append(clone)
            kept = set()
        updates[p["id"]] = f
        final[p["id"]] = kept | R
        log.append(("UPDATE", row, p, diff, kept))
    else:
        creates.append({**f, "type": row["type"], "margin": 0, "restos": R, "why": None})
        log.append(("CREATE", row, None, [], set()))
    for p in by_key.get(row["key"], []):
        if p["id"] != home.get(i) and p["restos"] & R:
            final[p["id"]] = final.get(p["id"], p["restos"]) - R
            if not final[p["id"]]:
                deactivate[p["id"]] = f"vide : {names(p['restos'] & R)} repris par '{row['nom']}'"

for p in prods:
    if loose(p["name"]) in DEACTIVATE_NAMES and p["is_active"]:
        deactivate[p["id"]] = "supprime par FX"
groups = collections.defaultdict(list)
for p in prods:
    if p["is_active"] and p["id"] not in deactivate:
        groups[(norm(p["name"]), p["type"], frozenset(final.get(p["id"], p["restos"])))].append(p)
arbitrate = []
for v in groups.values():
    if len(v) < 2:
        continue
    prices = {round(p["unit_price_ttc"] or 0, 2) for p in v}
    real = [p for p in v if (p["unit_price_ttc"] or 0) > 0]
    if len(prices) == 1 or len(real) == 1:
        # meme prix, ou un seul prix non nul : le choix est evident
        keep = next((p for p in v if p["id"] in updates), None) or (real[0] if len(real) == 1 else max(v, key=lambda p: (p["updated_at"] or "", p["created_at"] or "")))
        for p in v:
            if p["id"] != keep["id"]:
                deactivate[p["id"]] = f"doublon de '{keep['name']}' ({keep['unit_price_ttc']} EUR garde, celui-ci {p['unit_price_ttc']})"
    else:
        arbitrate.append(v)
for p in prods:
    if p["is_active"] and not p["all_restaurants"] and not p["restos"] and p["id"] not in deactivate and p["id"] not in final:
        deactivate[p["id"]] = "orphelin, aucun resto"
renames = {p["id"]: clean_name(p["name"]) for p in prods
           if clean_name(p["name"]) != p["name"] and p["id"] not in updates and p["is_active"]}

# ---------------------------------------------------------------- rapport
section("fichier")
line("lignes", f"{len(df)} -> {len(rows)} apres fusion des lignes identiques")
section("plan")
ups = [l for l in log if l[0] == "UPDATE"]
line("UPDATE (produit existant, libelle FX)", f"{len(ups)} dont {sum(1 for l in ups if any(d.startswith('name') for d in l[3]))} renommes, {sum(1 for l in ups if any(d.startswith('unit_price_ttc') for d in l[3]))} changent de prix")
line("CREATE", f"{len(creates)} dont {sum(1 for c in creates if c['why'])} scissions (anciens prix conserves)")
line("liaisons resto recalculees sur", f"{len(final)} produits")
line("DESACTIVE", f"{len(deactivate)} ({sum(1 for v in deactivate.values() if v.startswith('vide'))} vides, {sum(1 for v in deactivate.values() if v.startswith('doublon'))} doublons, {sum(1 for v in deactivate.values() if v.startswith('orphelin'))} orphelins, {sum(1 for v in deactivate.values() if v.startswith('supprime'))} FX)")
line("noms nettoyes (espaces)", len(renames))
for kind, row, p, diff, kept in log:
    if kind == "UPDATE" and (diff or final[p["id"]] != p["restos"]):
        print(f"  ~ {p['name'][:40]:42} -> {row['nom'][:40]:42} {', '.join(diff)}")
        if final[p["id"]] != p["restos"]:
            print(f"      restos : {names(p['restos'])}  ->  {names(final[p['id']])}")
for c in creates:
    print(f"  + {c['name'][:42]:44} {c['unit_price_ttc']:>8} EUR  {names(c['restos'])}" + (f"   [{c['why']}]" if c["why"] else ""))
for pid, why in deactivate.items():
    print(f"  x {by_id[pid]['name'][:42]:44} {by_id[pid]['unit_price_ttc']:>8} EUR  {names(by_id[pid]['restos'])}   [{why}]")
for pid, n in renames.items():
    print(f"  . {by_id[pid]['name']!r} -> {n!r}")
section("a trancher par FX (rien n'est fait)")
for v in arbitrate:
    print(f"  ? {v[0]['name'][:44]:46} {names(v[0]['restos']):24} prix : {' / '.join(str(p['unit_price_ttc']) for p in v)}")
print("  ? libelles des menus dejeuner (Menu Mimi / Menu Podium / La-Haut 'pour le dejeuner') : a preciser")
print("  ? Cocktail au litre 85 EUR TTC TVA 20 (6 cocktails) et Mocktail au litre 55 EUR TVA 10 : pour quels restos ?")

if not apply:
    print("\nDry-run. Relancer avec --apply pour executer (backup automatique).")
    sys.exit(0)

# ---------------------------------------------------------------- apply
touched = set(updates) | set(final) | set(deactivate) | set(renames)
stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_DIR.mkdir(exist_ok=True)
backup = BACKUP_DIR / f"sync_fx_{stamp}.json"
backup.write_text(json.dumps({
    "products": [{k: v for k, v in by_id[pid].items() if k not in ("restos", "key")} for pid in touched],
    "product_restaurants": [l for l in links if l["product_id"] in touched],
    "created_names": [c["name"] for c in creates],
}, ensure_ascii=False, indent=1, default=str))
print(f"\nbackup : {backup}")

for pid, n in renames.items():
    db.patch("products", f"id=eq.{pid}", {"name": n})
for pid, f in updates.items():
    db.patch("products", f"id=eq.{pid}", f)
for pid in deactivate:
    db.patch("products", f"id=eq.{pid}", {"is_active": False})
created = db.insert("products", [{k: v for k, v in c.items() if k not in ("restos", "why")}
                                 | {"organization_id": ORG_ID, "is_active": True, "all_restaurants": False}
                                 for c in creates]) if creates else []
for c, made in zip(creates, created):
    final[made["id"]] = c["restos"]
for pid, want in final.items():
    have = restos_of.get(pid, set())
    gone, new = have - want, want - have
    if gone:
        db.delete("product_restaurants", f"product_id=eq.{pid}&restaurant_id=in.({','.join(gone)})")
    if new:
        db.insert("product_restaurants", [{"product_id": pid, "restaurant_id": r} for r in new])
print(f"applique : {len(renames)} noms, {len(updates)} updates, {len(created)} creations, {len(deactivate)} desactivations, liaisons sur {len(final)} produits")
