-- ============================================
-- VERIFICATION QUERIES - Check what was executed
-- ============================================

-- 1. Check if status_id column was removed from contacts
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='contacts' AND column_name='status_id'
    ) THEN 'FAILED - status_id still exists'
    ELSE 'SUCCESS - status_id removed'
  END as step_2_remove_status_from_contacts;

-- 2. Check if idx_contacts_status index was removed
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename='contacts' AND indexname='idx_contacts_status'
    ) THEN 'FAILED - index still exists'
    ELSE 'SUCCESS - index removed'
  END as step_2_remove_index;

-- 3. Check if contact statuses were deleted
SELECT 
  COUNT(*) as contact_statuses_remaining,
  CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS - all contact statuses deleted'
    ELSE 'FAILED - contact statuses still exist'
  END as step_3_delete_contact_statuses
FROM statuses 
WHERE type = 'contact';

-- 4. Check if 'both' type statuses were deleted
SELECT 
  COUNT(*) as both_statuses_remaining,
  CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS - all both statuses deleted'
    ELSE 'FAILED - both statuses still exist'
  END as step_3_delete_both_statuses
FROM statuses 
WHERE type = 'both';

-- 5. Check if only 'booking' type statuses exist
SELECT 
  DISTINCT type as status_types_remaining,
  COUNT(*) as count
FROM statuses 
GROUP BY type;

-- 6. Check if new unique constraint exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name='statuses' 
      AND constraint_name='statuses_organization_id_slug_key'
    ) THEN 'SUCCESS - new constraint exists'
    ELSE 'FAILED - new constraint missing'
  END as step_3_new_constraint;

-- 7. Check if old constraint was removed
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name='statuses' 
      AND constraint_name='statuses_organization_id_slug_type_key'
    ) THEN 'FAILED - old constraint still exists'
    ELSE 'SUCCESS - old constraint removed'
  END as step_3_old_constraint_removed;

-- 8. Check if check constraint exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name='statuses' 
      AND constraint_name='statuses_type_check'
    ) THEN 'SUCCESS - check constraint exists'
    ELSE 'FAILED - check constraint missing'
  END as step_3_check_constraint;

-- 9. Check if contacts trigger exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname='update_contacts_updated_at'
    ) THEN 'SUCCESS - contacts trigger exists'
    ELSE 'FAILED - contacts trigger missing'
  END as step_6_contacts_trigger;

-- 10. Check if booking_events trigger exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname='update_booking_events_updated_at'
    ) THEN 'SUCCESS - booking_events trigger exists'
    ELSE 'FAILED - booking_events trigger missing'
  END as step_7_booking_events_trigger;

-- 11. Summary: Count remaining bookings with status
SELECT 
  COUNT(*) as bookings_with_status
FROM bookings 
WHERE status_id IS NOT NULL;

-- 12. Summary: Verify no contacts have status_id
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name='contacts' AND column_name='status_id'
    ) THEN 'SUCCESS - status_id column removed from contacts'
    ELSE 'FAILED - status_id column still exists'
  END as contacts_status_check;

-- ============================================
-- EXECUTION SUMMARY
-- ============================================
-- Run all queries above to see what was executed
-- Each query will show SUCCESS or FAILED status
-- ============================================
