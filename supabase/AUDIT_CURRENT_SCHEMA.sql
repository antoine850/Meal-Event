-- ============================================
-- COMPREHENSIVE AUDIT OF CURRENT SCHEMA
-- After Migration 13: Status Refactoring
-- ============================================

-- ============================================
-- SECTION 1: CONTACTS TABLE AUDIT
-- ============================================

-- 1.1: Show all columns in contacts table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;

-- 1.2: Show all indexes on contacts table
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'contacts'
ORDER BY indexname;

-- 1.3: Show all constraints on contacts table
SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'contacts'
ORDER BY constraint_name;

-- 1.4: Show foreign keys for contacts table
SELECT 
  constraint_name,
  column_name,
  table_name,
  ordinal_position
FROM information_schema.key_column_usage
WHERE table_name = 'contacts' AND constraint_name LIKE '%fkey'
ORDER BY constraint_name;

-- 1.5: Count contacts and show sample data
SELECT 
  'Total contacts' as metric,
  COUNT(*) as count
FROM contacts;

-- 1.6: Show contacts structure with data types
SELECT 
  'Column Count' as metric,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'contacts';

-- ============================================
-- SECTION 2: BOOKINGS TABLE AUDIT
-- ============================================

-- 2.1: Show all columns in bookings table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;

-- 2.2: Show all indexes on bookings table
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'bookings'
ORDER BY indexname;

-- 2.3: Show all constraints on bookings table
SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'bookings'
ORDER BY constraint_name;

-- 2.4: Show foreign keys for bookings table
SELECT 
  constraint_name,
  column_name,
  table_name,
  ordinal_position
FROM information_schema.key_column_usage
WHERE table_name = 'bookings' AND constraint_name LIKE '%fkey'
ORDER BY constraint_name;

-- 2.5: Count bookings and show sample data
SELECT 
  'Total bookings' as metric,
  COUNT(*) as count
FROM bookings;

-- 2.6: Show bookings with status information
SELECT 
  COUNT(*) as bookings_with_status,
  COUNT(CASE WHEN status_id IS NULL THEN 1 END) as bookings_without_status
FROM bookings;

-- 2.7: Show bookings structure with data types
SELECT 
  'Column Count' as metric,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'bookings';

-- ============================================
-- SECTION 3: BOOKING_EVENTS TABLE AUDIT
-- ============================================

-- 3.1: Show all columns in booking_events table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'booking_events'
ORDER BY ordinal_position;

-- 3.2: Show all indexes on booking_events table
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'booking_events'
ORDER BY indexname;

-- 3.3: Show all constraints on booking_events table
SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'booking_events'
ORDER BY constraint_name;

-- 3.4: Show foreign keys for booking_events table
SELECT 
  constraint_name,
  column_name,
  table_name,
  ordinal_position
FROM information_schema.key_column_usage
WHERE table_name = 'booking_events' AND constraint_name LIKE '%fkey'
ORDER BY constraint_name;

-- 3.5: Count booking_events and show sample data
SELECT 
  'Total booking_events' as metric,
  COUNT(*) as count
FROM booking_events;

-- 3.6: Show booking_events structure with data types
SELECT 
  'Column Count' as metric,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'booking_events';

-- 3.7: Show relationship between bookings and booking_events
SELECT 
  COUNT(DISTINCT b.id) as total_bookings,
  COUNT(DISTINCT be.booking_id) as bookings_with_events,
  COUNT(be.id) as total_events,
  ROUND(AVG(event_count), 2) as avg_events_per_booking
FROM bookings b
LEFT JOIN booking_events be ON b.id = be.booking_id
LEFT JOIN (
  SELECT booking_id, COUNT(*) as event_count
  FROM booking_events
  GROUP BY booking_id
) event_counts ON b.id = event_counts.booking_id;

-- ============================================
-- SECTION 4: STATUSES TABLE AUDIT
-- ============================================

-- 4.1: Show all columns in statuses table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'statuses'
ORDER BY ordinal_position;

-- 4.2: Show all constraints on statuses table
SELECT 
  constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'statuses'
ORDER BY constraint_name;

-- 4.3: Show all statuses by type
SELECT 
  type,
  COUNT(*) as count,
  STRING_AGG(name, ', ' ORDER BY name) as status_names
FROM statuses
GROUP BY type
ORDER BY type;

-- 4.4: Show all statuses with details
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

-- 4.5: Verify check constraint on type
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%status%'
ORDER BY constraint_name;

-- ============================================
-- SECTION 5: RELATIONSHIPS AUDIT
-- ============================================

-- 5.1: Show contacts to bookings relationship
SELECT 
  COUNT(DISTINCT c.id) as total_contacts,
  COUNT(DISTINCT b.contact_id) as contacts_with_bookings,
  COUNT(b.id) as total_bookings,
  ROUND(AVG(booking_count), 2) as avg_bookings_per_contact
FROM contacts c
LEFT JOIN bookings b ON c.id = b.contact_id
LEFT JOIN (
  SELECT contact_id, COUNT(*) as booking_count
  FROM bookings
  GROUP BY contact_id
) booking_counts ON c.id = booking_counts.contact_id;

-- 5.2: Show status usage in bookings
SELECT 
  s.type,
  s.name,
  COUNT(b.id) as bookings_with_this_status
FROM statuses s
LEFT JOIN bookings b ON s.id = b.status_id
GROUP BY s.id, s.type, s.name
ORDER BY s.type, s.position;

-- 5.3: Verify no contacts have status references
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='contacts' AND column_name='status_id'
    ) THEN 'FAILED - status_id column still exists in contacts'
    ELSE 'SUCCESS - status_id column removed from contacts'
  END as contacts_status_check;

-- ============================================
-- SECTION 6: DATA INTEGRITY CHECKS
-- ============================================

-- 6.1: Check for orphaned booking statuses
SELECT 
  COUNT(*) as bookings_with_invalid_status
FROM bookings b
WHERE status_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM statuses s WHERE s.id = b.status_id
  );

-- 6.2: Check for orphaned booking events
SELECT 
  COUNT(*) as booking_events_with_invalid_booking
FROM booking_events be
WHERE NOT EXISTS (
  SELECT 1 FROM bookings b WHERE b.id = be.booking_id
);

-- 6.3: Check for orphaned contacts
SELECT 
  COUNT(*) as contacts_with_invalid_company
FROM contacts c
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM companies co WHERE co.id = c.company_id
  );

-- 6.4: Check for orphaned contacts (assigned_to)
SELECT 
  COUNT(*) as contacts_with_invalid_user
FROM contacts c
WHERE assigned_to IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = c.assigned_to
  );

-- 6.5: Check for orphaned bookings
SELECT 
  COUNT(*) as bookings_with_invalid_contact
FROM bookings b
WHERE contact_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = b.contact_id
  );

-- ============================================
-- SECTION 7: TRIGGERS AUDIT
-- ============================================

-- 7.1: Show all triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 7.2: Verify update_contacts_updated_at trigger
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname='update_contacts_updated_at'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as update_contacts_trigger;

-- 7.3: Verify update_booking_events_updated_at trigger
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname='update_booking_events_updated_at'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as update_booking_events_trigger;

-- ============================================
-- SECTION 8: SUMMARY REPORT
-- ============================================

-- 8.1: Complete schema summary
SELECT 
  'CONTACTS' as table_name,
  COUNT(*) as column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename='contacts') as index_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name='contacts') as constraint_count
FROM information_schema.columns
WHERE table_name = 'contacts'
UNION ALL
SELECT 
  'BOOKINGS' as table_name,
  COUNT(*) as column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename='bookings') as index_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name='bookings') as constraint_count
FROM information_schema.columns
WHERE table_name = 'bookings'
UNION ALL
SELECT 
  'BOOKING_EVENTS' as table_name,
  COUNT(*) as column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename='booking_events') as index_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name='booking_events') as constraint_count
FROM information_schema.columns
WHERE table_name = 'booking_events'
UNION ALL
SELECT 
  'STATUSES' as table_name,
  COUNT(*) as column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename='statuses') as index_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name='statuses') as constraint_count
FROM information_schema.columns
WHERE table_name = 'statuses';

-- 8.2: Data volume summary
SELECT 
  'contacts' as table_name,
  COUNT(*) as row_count
FROM contacts
UNION ALL
SELECT 
  'bookings' as table_name,
  COUNT(*) as row_count
FROM bookings
UNION ALL
SELECT 
  'booking_events' as table_name,
  COUNT(*) as row_count
FROM booking_events
UNION ALL
SELECT 
  'statuses' as table_name,
  COUNT(*) as row_count
FROM statuses;

-- ============================================
-- END OF AUDIT SCRIPT
-- ============================================
-- Run all queries above to get a complete picture
-- of the current schema after migration 13
-- ============================================
