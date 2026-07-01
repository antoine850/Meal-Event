"""Outils partages pour l'import Booking Shake -> MealEvent. Lecture seule sauf upsert() explicite."""
import csv, json, os, sys, time, urllib.request, urllib.error
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CSV_DIR = Path(os.environ.get("BOOKING_SHAKE_CSV_DIR", "/Users/thomas/Downloads"))
# Exports FRAIS (2026-06-30). Les anciens etaient document (1)/(3) ; on lit le frais pour la reconciliation.
EVENTS_CSV = CSV_DIR / "document (7).csv"
CONTACTS_CSV = CSV_DIR / "document (2).csv"
BILLING_CSV = CSV_DIR / "document (8).csv"

ORG_ID = "425be1b8-f059-4a4f-8e94-d8b8fe69ab27"
SOURCE = "booking_shake"

# Cles = chaines EXACTES des CSV (accents compris).
VENUE_TO_RESTAURANT = {
    "Splash": "0c315e35-9267-442e-a3a4-0d25aa8966d7",
    "Podium": "645bc1f1-514e-4129-b695-044baa02caa5",
    "Restaurant Podium (compte fermé)": "645bc1f1-514e-4129-b695-044baa02caa5",
    "Bistrot Là-Haut": "d7bd3aab-9989-46f9-985e-e596ef126e83",
    "Saperlipopette": "273d4b2d-487b-4f88-a141-fc8a9b12887e",
    "Sapristi": "24e37737-b5fd-4abb-ae90-b8acde51186f",
    "Bistrot Micheline": "9dba1694-4355-4372-89e4-03783cba3b64",
    "Coco Rocco": "4f251aa4-36e2-44fe-97f8-e1721e37802d",
    "Papa Pool": "c9c9525d-52c2-4afe-a3fe-592e7e6c4d16",
    "Tata Yoyo": "23f49e05-f0dd-48ae-9feb-6f1ffb700528",
    "Le Bistrot des Chefs": "e5024c05-9db3-4a29-b943-de66609f6427",
    "Monsieur Claude": "1ca8d32c-6b34-44cb-8d24-1c94f9e40543",
    "Chez Mimi": "53926e78-3886-4b31-a3d4-4da04a86644a",
    "Chou de Chanorier": "e1b8cdeb-b3ee-4644-8bd2-0c9c81bca80c",
    "Madame Soleil": "44eac888-c0fa-4375-8d35-91c97e98b2a3",
}

STATUS_TO_ID = {
    "Annulé": "b1acefc2-35af-4998-862e-d8211cc5190b",
    "Cloturé": "a686adf0-b2b6-4a1c-bd80-6f8ced5ddac2",
    "Proposition": "e4d4ee59-8d07-4a0b-afbb-b98fd41bbeb1",
    "Qualification": "2d6abba1-a020-47cd-b080-e55fcaa79107",
    "Confirmé / Fonction à faire": "85065292-e6cd-4a44-b753-9ee0c849f0b4",
    "Conf. / Fct° à faire": "85065292-e6cd-4a44-b753-9ee0c849f0b4",
    "Attente paiement": "2bcaa4c0-4db9-4078-b4eb-c92a7847035a",
    "A facturer": "8dfd7e86-f756-4fcb-b3e8-4103ed155e3a",
    "Négociation": "41d8487a-9935-4ac4-9cc7-8026df06e971",
    "Relance paiement": "40243d09-9512-4c51-80f3-968dba5c23cf",
    "Fonction envoyée": "75a3b488-368e-4d2e-99ee-0f7cb66b4a51",
    "Nouveau": "3d355958-c090-47c3-b53b-765b06834264",
    "Report": "2d6abba1-a020-47cd-b080-e55fcaa79107",  # pas d'equivalent BS -> Qualification
}

# Valeurs cibles alignees sur l'existant prod (payment_method).
PAYMENT_METHOD_MAP = {
    "virement": "virement",
    "stripe": "stripe",
    "carte bancaire sur place": "cb_restaurant",
    "carte bancaire à distance": "stripe",
    "paiement en ligne": "stripe",
    "espèces": "cash",
    "amex": "cb_restaurant",
}

# Normalisation du canal d'acquisition vers les slugs utilises par l'app.
SOURCE_MAP = {
    "booking shake - site web": "website",
    "direct": "direct",
    "téléphone": "phone",
    "kactus": "kactus",
}

# Longueurs max des colonnes varchar (le reste est en text, sans limite).
MAXLEN = {
    "companies": {"name": 255, "email": 255, "website": 255, "city": 100, "country": 100,
                  "postal_code": 20, "phone": 50, "siret": 50, "tva_number": 50},
    "contacts": {"first_name": 100, "last_name": 100, "job_title": 100, "city": 100, "source": 100,
                 "email": 255, "postal_code": 20, "mobile": 50, "phone": 50},
    "quotes": {"quote_number": 50, "status": 50, "order_number": 100, "language": 2},
    "quote_items": {"name": 255},
    "payments": {"payment_type": 50, "payment_method": 50, "status": 50},
    "users": {"email": 255, "first_name": 100, "last_name": 100},
}


def load_env():
    env = {}
    for fn in ("backend/.env", "backend/.env.local"):
        p = REPO_ROOT / fn
        if not p.exists():
            continue
        for raw in p.read_text().splitlines():
            ln = raw.strip()
            if not ln or ln.startswith("#") or "=" not in ln:
                continue
            k, v = ln.split("=", 1)
            env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    url = os.environ.get("SUPABASE_URL") or env.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    db_url = os.environ.get("SUPABASE_DB_URL") or env.get("SUPABASE_DB_URL")
    if not url or not key:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans backend/.env")
    return url.rstrip("/"), key, db_url


def s(v):
    if v is None:
        return None
    v = v.strip()
    if v in ("", "_", "Invalid Date", "N/A", "-"):
        return None
    return v


def dec(v):
    v = s(v)
    if v is None:
        return None
    v = v.replace(" ", "").replace(" ", "").replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def date_iso(v):
    v = s(v)
    if v is None:
        return None
    part = v.split(" ")[0]
    bits = part.split("-")
    if len(bits) != 3 or not all(b.isdigit() for b in bits):
        return None
    d, m, y = (int(b) for b in bits)
    if not (1 <= m <= 12 and 1 <= d <= 31 and y >= 1900):
        return None
    return f"{y:04d}-{m:02d}-{d:02d}"


def boolfr(v):
    v = s(v)
    if v is None:
        return None
    lv = v.lower()
    if lv in ("oui", "yes", "true", "1", "vrai"):
        return True
    if lv in ("non", "no", "false", "0", "faux"):
        return False
    return None


def clock(v):
    v = s(v)
    if v is None:
        return None
    p = v.split(":")
    if len(p) >= 2 and p[0].isdigit() and p[1].isdigit():
        h, m = int(p[0]), int(p[1])
        if 0 <= h <= 23 and 0 <= m <= 59:
            return f"{h:02d}:{m:02d}"
    return None


def unit_price_ht(item):
    """P.U. HT au centime depuis total_ht/quantite. L'app traite unit_price comme du HT et
    re-applique la TVA (roundLineTtc) ; stocker le P.U. TTC du PDF BS doublerait la TVA a la
    re-edition. total_ht=0 -> 0 (ligne offerte/incluse) ; total_ht absent -> derive du TTC."""
    qty = item.get("quantity") or 0
    if not qty:
        return item.get("unit_price")
    ht = item.get("total_ht")
    if ht is None:
        ttc, rate = item.get("total_ttc") or 0, item.get("tva_rate") or 0
        if not ttc:
            return item.get("unit_price")
        ht = ttc / (1 + rate / 100)
    # arrondi au centime half-away-from-zero, comme le type numeric Postgres de la colonne.
    return float((Decimal(str(ht)) / Decimal(qty)).quantize(Decimal("0.01"), ROUND_HALF_UP))


def load_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def arg_events():
    for a in sys.argv:
        if a.startswith("--events="):
            return {e.strip() for e in a.split("=", 1)[1].split(",") if e.strip()}
    return None


class Supa:
    def __init__(self, url, key):
        self.url = url
        self.h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def _req(self, method, path, body=None, extra=None):
        headers = dict(self.h)
        if extra:
            headers.update(extra)
        data = json.dumps(body).encode() if body is not None else None
        for attempt in range(4):
            req = urllib.request.Request(self.url + path, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    return r.status, r.read().decode()
            except urllib.error.HTTPError as e:
                if e.code in (429, 502, 503, 504, 520, 522, 524) and attempt < 3:
                    time.sleep(1.5 * (attempt + 1)); continue
                raise RuntimeError(f"{method} {path.split('?')[0]} -> {e.code}: {e.read().decode()[:400]}")
            except OSError:  # URLError, ConnectionResetError, timeouts, socket errors
                if attempt < 3:
                    time.sleep(1.5 * (attempt + 1)); continue
                raise

    def get_all(self, table, select="*", query=""):
        out, offset, page = [], 0, 1000
        while True:
            q = f"/rest/v1/{table}?select={select}&limit={page}&offset={offset}&order=id"
            if query:
                q += "&" + query
            _, raw = self._req("GET", q)
            chunk = json.loads(raw)
            out.extend(chunk)
            if len(chunk) < page:
                return out
            offset += page

    def patch(self, table, flt, body):
        self._req("PATCH", f"/rest/v1/{table}?{flt}", body=body,
                  extra={"Prefer": "return=minimal"})

    def upsert(self, table, rows, on_conflict, batch=500):
        limits = MAXLEN.get(table, {})
        for r in rows:
            for col, mx in limits.items():
                v = r.get(col)
                if isinstance(v, str) and len(v) > mx:
                    r[col] = v[:mx]
        for i in range(0, len(rows), batch):
            self._req(
                "POST",
                f"/rest/v1/{table}?on_conflict={on_conflict}",
                body=rows[i:i + batch],
                extra={"Prefer": "resolution=merge-duplicates,return=minimal"},
            )
        return len(rows)


def section(title):
    print(f"\n=== {title} ===")


def line(k, v):
    print(f"  {k:<44} {v}")
