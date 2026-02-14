-- ============================================
-- DETAILED AUDIT RESULTS - All Information
-- ============================================

-- ============================================
-- 1. CONTACTS TABLE - COMPLETE STRUCTURE
-- ============================================

SELECT '=== CONTACTS TABLE COLUMNS ===' as section;

SELECT 
  ordinal_position as position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;

-- ============================================
-- 2. CONTACTS TABLE - INDEXES
-- ============================================

SELECT '=== CONTACTS TABLE INDEXES ===' as section;

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'contacts'
ORDER BY indexname;

-- ============================================
-- 3. CONTACTS TABLE - CONSTRAINTS
-- ============================================

SELECT '=== CONTACTS TABLE CONSTRAINTS ===' as section;

SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'contacts'
ORDER BY constraint_name;

-- ============================================
-- 4. BOOKINGS TABLE - COMPLETE STRUCTURE
-- ============================================

SELECT '=== BOOKINGS TABLE COLUMNS ===' as section;

SELECT 
  ordinal_position as position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;

-- ============================================
-- 5. BOOKINGS TABLE - INDEXES
-- ============================================

SELECT '=== BOOKINGS TABLE INDEXES ===' as section;

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'bookings'
ORDER BY indexname;

-- ============================================
-- 6. BOOKINGS TABLE - CONSTRAINTS
-- ============================================

SELECT '=== BOOKINGS TABLE CONSTRAINTS ===' as section;

SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'bookings'
ORDER BY constraint_name;

-- ============================================
-- 7. BOOKING_EVENTS TABLE - COMPLETE STRUCTURE
-- ============================================

SELECT '=== BOOKING_EVENTS TABLE COLUMNS ===' as section;

SELECT 
  ordinal_position as position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'booking_events'
ORDER BY ordinal_position;

-- ============================================
-- 8. BOOKING_EVENTS TABLE - INDEXES
-- ============================================

SELECT '=== BOOKING_EVENTS TABLE INDEXES ===' as section;

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'booking_events'
ORDER BY indexname;

-- ============================================
-- 9. BOOKING_EVENTS TABLE - CONSTRAINTS
-- ============================================

SELECT '=== BOOKING_EVENTS TABLE CONSTRAINTS ===' as section;

SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'booking_events'
ORDER BY constraint_name;

-- ============================================
-- 10. STATUSES TABLE - COMPLETE STRUCTURE
-- ============================================

SELECT '=== STATUSES TABLE COLUMNS ===' as section;

SELECT 
  ordinal_position as position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'statuses'
ORDER BY ordinal_position;

-- ============================================
-- 11. STATUSES TABLE - CONSTRAINTS
-- ============================================

SELECT '=== STATUSES TABLE CONSTRAINTS ===' as section;

SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'statuses'
ORDER BY constraint_name;

-- ============================================
-- 12. STATUSES TABLE - CHECK CONSTRAINTS
-- ============================================

SELECT '=== STATUSES TABLE CHECK CONSTRAINTS ===' as section;

SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%status%'
ORDER BY constraint_name;

-- ============================================
-- 13. ALL STATUSES - DATA
-- ============================================

SELECT '=== ALL STATUSES IN DATABASE ===' as section;

SELECT 
  id,
  organization_id,
  name,
  slug,
  color,
  type,
  position,
  is_default,
  created_at
FROM statuses
ORDER BY type, position, name;

-- ============================================
-- 14. BOOKINGS WITH STATUS DETAILS
-- ============================================

SELECT '=== BOOKINGS WITH STATUS DETAILS ===' as section;

SELECT 
  b.id as booking_id,
  b.event_date,
  b.start_time,
  b.end_time,
  b.guests_count,
  b.status_id,
  s.name as status_name,
  s.type as status_type,
  s.color as status_color,
  b.created_at
FROM bookings b
LEFT JOIN statuses s ON b.status_id = s.id
ORDER BY b.event_date;

-- ============================================
-- 15. BOOKING_EVENTS WITH DETAILS
-- ============================================

SELECT '=== BOOKING_EVENTS WITH DETAILS ===' as section;

SELECT 
  be.id,
  be.booking_id,
  be.name,
  be.event_date,
  be.start_time,
  be.end_time,
  be.guests_count,
  be.occasion,
  be.is_privatif,
  be.budget_client,
  be.created_at
FROM booking_events be
ORDER BY be.event_date;

-- ============================================
-- 16. CONTACTS WITH DETAILS
-- ============================================

SELECT '=== CONTACTS WITH DETAILS ===' as section;

SELECT 
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.mobile,
  c.job_title,
  c.company_id,
  c.assigned_to,
  c.source,
  c.created_at
FROM contacts c
ORDER BY c.created_at;

-- ============================================
-- 17. VERIFICATION - NO STATUS IN CONTACTS
-- ============================================

SELECT '=== VERIFICATION: NO STATUS_ID IN CONTACTS ===' as section;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='contacts' AND column_name='status_id'
    ) THEN 'FAILED - status_id column still exists'
    ELSE 'SUCCESS - status_id column removed'
  END as verification;

-- ============================================
-- 18. VERIFICATION - ONLY BOOKING STATUSES
-- ============================================

SELECT '=== VERIFICATION: ONLY BOOKING STATUSES ===' as section;

SELECT 
  type,
  COUNT(*) as count
FROM statuses
GROUP BY type
ORDER BY type;

-- ============================================
-- END OF DETAILED AUDIT
-- ============================================
