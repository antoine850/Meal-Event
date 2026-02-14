-- ============================================
-- EXPORT ALL TABLES, COLUMNS, AND RELATIONSHIPS
-- ============================================

-- ============================================
-- PART 1: ALL TABLES WITH THEIR COLUMNS
-- ============================================

SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN ('contacts', 'bookings', 'booking_events', 'statuses', 'companies', 'users', 'restaurants')
ORDER BY t.table_name, c.ordinal_position;

-- ============================================
-- PART 2: ALL FOREIGN KEY RELATIONSHIPS
-- ============================================

SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table_name,
  ccu.column_name AS referenced_column_name,
  rc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('contacts', 'bookings', 'booking_events', 'statuses', 'companies', 'users', 'restaurants')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- PART 3: ALL INDEXES
-- ============================================

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('contacts', 'bookings', 'booking_events', 'statuses', 'companies', 'users', 'restaurants')
ORDER BY tablename, indexname;

-- ============================================
-- PART 4: ALL CONSTRAINTS (PRIMARY, UNIQUE, CHECK)
-- ============================================

SELECT 
  table_name,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name IN ('contacts', 'bookings', 'booking_events', 'statuses', 'companies', 'users', 'restaurants')
ORDER BY table_name, constraint_name;

-- ============================================
-- PART 5: CHECK CONSTRAINTS DETAILS
-- ============================================

SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
ORDER BY constraint_name;

-- ============================================
-- PART 6: SUMMARY - TABLE OVERVIEW
-- ============================================

SELECT 
  t.table_name,
  COUNT(c.column_name) as column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.table_name) as index_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = t.table_name AND table_schema = 'public') as constraint_count
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN ('contacts', 'bookings', 'booking_events', 'statuses', 'companies', 'users', 'restaurants')
GROUP BY t.table_name
ORDER BY t.table_name;
