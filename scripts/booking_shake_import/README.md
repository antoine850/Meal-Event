# Import Booking Shake -> MealEvent

Design complet : [../../docs/superpowers/specs/2026-06-04-booking-shake-import-design.md](../../docs/superpowers/specs/2026-06-04-booking-shake-import-design.md)

## Pre-requis

1. Appliquer la migration `supabase/migrations/20260604_booking_shake_import_tracking.sql` (SQL Editor Supabase, ou via la connection string).
2. CSV d'export dans `~/Downloads` (ou definir `BOOKING_SHAKE_CSV_DIR`).
3. `backend/.env` doit contenir `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (deja le cas).

## Execution

Dry-run par defaut (aucune ecriture, ne necessite que la lecture) :

```
python3 scripts/booking_shake_import/phase1_contacts.py
python3 scripts/booking_shake_import/phase2_bookings.py
python3 scripts/booking_shake_import/phase3_billing.py
```

Ecriture reelle (apres validation du dry-run + migration appliquee), phase par phase dans l'ordre :

```
python3 scripts/booking_shake_import/phase1_contacts.py --apply
python3 scripts/booking_shake_import/phase2_bookings.py --apply
python3 scripts/booking_shake_import/phase3_billing.py --apply
```

Idempotent : chaque re-run fait un upsert sur `(organization_id, external_source, external_id)`, jamais de doublon.
