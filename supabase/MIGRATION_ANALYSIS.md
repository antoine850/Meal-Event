# Migration Analysis: Status Management Refactoring

## Current State Analysis

### Schema Examination Results

#### 1. **CONTACTS TABLE** (schema.sql, lines 184-203)
**Current columns:**
- id, organization_id, company_id
- **status_id** ← TO REMOVE (line 188)
- assigned_to, first_name, last_name, email, phone, mobile
- job_title, address, city, postal_code, notes, source
- created_at, updated_at

**Current indexes:**
- idx_contacts_status (line 516) ← TO REMOVE

**Status:** Contacts should NOT have statuses anymore

---

#### 2. **BOOKINGS TABLE** (schema.sql, lines 210-244)
**Current columns (ALL PRESENT & CORRECT):**
- id, organization_id, restaurant_id, contact_id
- **status_id** ← KEEP (line 215) - FK to statuses
- assigned_to, space_id, time_slot_id
- event_type, occasion, option, relance, source
- **event_date** ✓, **start_time** ✓, **end_time** ✓, **guests_count** ✓
- total_amount, deposit_amount, deposit_percentage
- is_table_blocked, has_extra_provider
- internal_notes, client_notes, special_requests, notion_url
- created_at, updated_at

**Status:** All fields present and editable ✓

---

#### 3. **BOOKING_EVENTS TABLE** (schema.sql, lines 248-298)
**Current columns (ALL PRESENT & CORRECT):**
- id, booking_id, space_id
- name, event_date, start_time, end_time, guests_count, occasion
- is_date_flexible, is_restaurant_flexible, client_preferred_time
- menu_aperitif, menu_entree, menu_plat, menu_dessert, menu_boissons, menu_details
- mise_en_place, deroulement, is_privatif
- allergies_regimes, prestations_souhaitees, budget_client, format_souhaite
- contact_sur_place_nom, contact_sur_place_tel, contact_sur_place_societe
- instructions_speciales, commentaires, date_signature_devis
- created_at, updated_at

**Status:** All fields present and editable ✓

---

#### 4. **STATUSES TABLE** (schema.sql, lines 151-162)
**Current columns:**
- id, organization_id, name, slug, color
- **type** (line 157): 'contact', 'booking', 'both' ← NEEDS CONSTRAINT
- position, is_default, created_at

**Current constraint:**
- UNIQUE(organization_id, slug, type) (line 161) ← TO CHANGE

**Status:** Needs constraint to only allow type='booking'

---

## Migration Plan

### STEP 1: Remove Status from Contacts
```sql
-- Remove foreign key
ALTER TABLE contacts DROP CONSTRAINT contacts_status_id_fkey;

-- Remove column
ALTER TABLE contacts DROP COLUMN status_id;

-- Remove index
DROP INDEX idx_contacts_status;
```

### STEP 2: Clean Statuses Table
```sql
-- Delete contact statuses
DELETE FROM statuses WHERE type = 'contact';

-- Delete 'both' type statuses
DELETE FROM statuses WHERE type = 'both';

-- Update constraint
ALTER TABLE statuses DROP CONSTRAINT statuses_organization_id_slug_type_key;
ALTER TABLE statuses ADD CONSTRAINT statuses_organization_id_slug_key UNIQUE(organization_id, slug);

-- Add check constraint
ALTER TABLE statuses ADD CONSTRAINT statuses_type_check CHECK (type = 'booking');
```

### STEP 3: Verify Bookings Structure
✓ All fields present
✓ All fields editable
✓ Status management centralized

### STEP 4: Verify Booking_Events Structure
✓ All fields present
✓ All fields editable
✓ Complete event details available

---

## Summary of Changes

### REMOVED
- ✓ contacts.status_id column
- ✓ idx_contacts_status index
- ✓ All statuses with type='contact'
- ✓ All statuses with type='both'
- ✓ Old unique constraint on statuses (organization_id, slug, type)

### ADDED
- ✓ Check constraint: statuses.type = 'booking'
- ✓ New unique constraint: (organization_id, slug)

### VERIFIED (No changes needed)
- ✓ All bookings fields present and editable
- ✓ All booking_events fields present and editable
- ✓ Status management centralized at organization level
- ✓ Statuses only apply to bookings, not contacts

---

## Application Code Changes (Already Done)

### Removed from Code
- ✓ useContactStatuses() hook removed
- ✓ status_id from contact creation schema
- ✓ status_id from contact detail schema
- ✓ Status field from contact forms
- ✓ Status column from contacts table UI
- ✓ Kanban and cards views removed (table view only)

### Kept in Code
- ✓ useBookingStatuses() hook
- ✓ status_id in booking creation schema
- ✓ status_id in booking detail schema
- ✓ Status field in booking forms
- ✓ Status display in booking details
- ✓ Dynamic status selection from organization settings

---

## Verification Queries

Run these after migration to verify success:

```sql
-- 1. Verify status_id removed from contacts
SELECT column_name FROM information_schema.columns 
WHERE table_name='contacts' AND column_name='status_id';
-- Expected: No rows

-- 2. Verify only 'booking' type statuses exist
SELECT DISTINCT type FROM statuses;
-- Expected: Only 'booking'

-- 3. Verify bookings still have status
SELECT COUNT(*) FROM bookings WHERE status_id IS NOT NULL;
-- Expected: Number > 0

-- 4. Verify no contact statuses
SELECT COUNT(*) FROM contacts WHERE status_id IS NOT NULL;
-- Expected: Error (column doesn't exist) or 0

-- 5. Check constraint is working
INSERT INTO statuses (organization_id, name, slug, type) 
VALUES ('test-org-id', 'Test', 'test', 'contact');
-- Expected: Error (violates check constraint)
```

---

## Files Modified

### Database
- ✓ migration-13-refactor-statuses-contacts.sql (created)

### Application Code (Already Updated)
- ✓ src/features/contacts/index.tsx
- ✓ src/features/contacts/components/contact-detail.tsx
- ✓ src/features/contacts/components/create-contact-dialog.tsx
- ✓ src/features/contacts/components/contacts-columns.tsx
- ✓ src/features/contacts/components/contacts-kanban.tsx (deleted)
- ✓ src/features/contacts/components/contacts-cards.tsx (deleted)
- ✓ src/features/contacts/hooks/use-contacts.ts
- ✓ src/features/contacts/types.ts
- ✓ src/features/settings/statuses/index.tsx
- ✓ src/features/reservations/components/booking-detail.tsx
- ✓ src/features/reservations/hooks/use-bookings.ts

---

## Status: READY FOR DEPLOYMENT

All SQL changes are documented and ready to apply to Supabase.
Application code has been updated to match the new schema.
Build is passing without errors.
