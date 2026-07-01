"""G5 -- consolide tous les residuels (cas a trancher par les equipes BS) en UN seul CSV.

Lit chaque fichier residuel produit par les autres phases (G1 arbitre, G2 devis...), les mappe sur
un schema commun et ecrit backups/equipes_a_trancher.csv. Re-run a chaque nouvelle phase : les
nouveaux residuels (G3 montant/acompte, G4 merges) s'ajoutent des qu'on depose leur CSV ici.
Lecture seule (pas de DB). Usage : python3 scripts/booking_shake_import/g5_consolidate_team_file.py"""
import csv
from collections import Counter
from pathlib import Path

BACKUP_DIR = Path(__file__).resolve().parent / "backups"
OUT = BACKUP_DIR / "equipes_a_trancher.csv"
COLS = ["objectif", "type", "event_id", "champ", "valeur_bs", "valeur_me",
        "statut_me", "montant_me", "quote_number", "editeur_me", "date_edition_me", "action_attendue"]

AX_LABEL = {"statut": "statut", "date": "date", "pax": "couverts"}


def read(name):
    p = BACKUP_DIR / name
    return list(csv.DictReader(open(p, encoding="utf-8"))) if p.exists() else []


def blank():
    return {c: "" for c in COLS}


rows = []

# G1 -- arbitre statuts/date/couverts : ME edite a la main apres import, BS differe.
for r in read("arbiter_residual.csv"):
    o = blank()
    o.update(objectif="G1 statut/planning", type=AX_LABEL.get(r["axe"], r["axe"]),
             event_id=r["event_id"], champ=AX_LABEL.get(r["axe"], r["axe"]),
             valeur_bs=r["valeur_BS"], valeur_me=r["valeur_ME"],
             editeur_me=r["dernier_editeur_ME"], date_edition_me=r["date_edition_ME"],
             action_attendue="ME modifie manuellement apres l'import, BS differe -- confirmer la valeur qui fait foi")
    rows.append(o)

# G2 -- devis a versions divergentes / illisibles / lignes incoherentes.
for r in read("g2_residual_devis.csv"):
    raison = r["raison"]
    if raison.startswith("versions_divergentes"):
        rng = raison.split("(", 1)[1].rstrip(")") if "(" in raison else ""
        typ, vbs = "version devis", f"versions {rng.replace('-', ' a ')} EUR" if rng else "versions divergentes"
        act = "Plusieurs versions de devis, totaux divergents, aucune validee -- indiquer la version qui fait foi"
    elif raison.startswith("lignes"):
        typ, vbs = "lignes incoherentes", raison
        act = "Les lignes du devis ne reconcilient pas le total -- verifier le detail"
    else:
        typ, vbs = "devis illisible", raison
        act = "PDF du devis illisible automatiquement -- fournir le detail des lignes"
    o = blank()
    o.update(objectif="G2 devis", type=typ, event_id=r["event_id"], champ="total devis",
             valeur_bs=vbs, valeur_me=r["total_ME"], statut_me=r["statut_ME"],
             montant_me=r["total_ME"], action_attendue=act)
    rows.append(o)

# G3 -- totaux facturés non tranchables auto : devis ambigu (versions/acompte) ou avoir.
for r in read("g3_residual_totaux.csv"):
    avoir = r["categorie"] == "avoir"
    o = blank()
    o.update(objectif="G3 facturation", type="avoir" if avoir else "total devis ambigu",
             event_id=r["event_id"], champ="total", valeur_me=r["total_ME"], montant_me=r["total_ME"],
             action_attendue=("Avoir present, net a trancher -- " + r["detail"]) if avoir
             else ("Total non determinable auto (" + r["detail"] + ") -- indiquer le devis qui fait foi"))
    rows.append(o)

# G2 -- devis impossibles a recuperer depuis BS (pas de PDF recolte ou pas de lien).
for r in read("g2_a_recuperer.csv"):
    act = ("Aucun lien BS (bookingId manquant) -- fournir le devis source"
           if r["raison"] == "no_bookingId"
           else "Devis non recupere depuis BS -- fournir le PDF / detail du devis")
    o = blank()
    o.update(objectif="G2 devis", type="devis introuvable", event_id=r["event_id"],
             valeur_me=r["total_ME"], statut_me=r["statut"], montant_me=r["total_ME"],
             quote_number=r["quote_number"], action_attendue=act)
    rows.append(o)

rows.sort(key=lambda r: (r["objectif"], r["type"], r["event_id"]))
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=COLS)
    w.writeheader()
    w.writerows(rows)

print(f"=== G5 -- fichier equipes consolide : {OUT.name} ===")
print(f"  total cas a trancher : {len(rows)}")
for k, v in Counter((r["objectif"], r["type"]) for r in rows).most_common():
    print(f"    {v:4}  {k[0]:18} {k[1]}")
