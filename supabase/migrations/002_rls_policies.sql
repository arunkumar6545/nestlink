-- ══════════════════════════════════════════════════════════════════
-- Nestlink MVP — Row Level Security Policies
-- ══════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE towers ENABLE ROW LEVEL SECURITY;
ALTER TABLE flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE domestic_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenity_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's society_id
CREATE OR REPLACE FUNCTION auth_society_id()
RETURNS UUID AS $$
  SELECT society_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's flat_id
CREATE OR REPLACE FUNCTION auth_flat_id()
RETURNS UUID AS $$
  SELECT flat_id FROM residents WHERE user_id = auth.uid() AND approved_at IS NOT NULL LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── user_profiles ─────────────────────────────────────────────────

-- Users can read their own profile; admins can read all in their society
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (
    id = auth.uid()
    OR auth_role() = 'admin'
    OR auth_role() = 'guard'
  );

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid() OR auth_role() = 'admin');

-- ─── societies ─────────────────────────────────────────────────────

CREATE POLICY "societies_select" ON societies
  FOR SELECT USING (
    id = auth_society_id()
    OR auth_role() = 'admin'
  );

CREATE POLICY "societies_all_admin" ON societies
  FOR ALL USING (auth_role() = 'admin' AND id = auth_society_id());

-- ─── towers ────────────────────────────────────────────────────────

CREATE POLICY "towers_select" ON towers
  FOR SELECT USING (society_id = auth_society_id());

CREATE POLICY "towers_all_admin" ON towers
  FOR ALL USING (auth_role() = 'admin' AND society_id = auth_society_id());

-- ─── flats ─────────────────────────────────────────────────────────

CREATE POLICY "flats_select" ON flats
  FOR SELECT USING (
    tower_id IN (SELECT id FROM towers WHERE society_id = auth_society_id())
  );

CREATE POLICY "flats_all_admin" ON flats
  FOR ALL USING (
    auth_role() = 'admin'
    AND tower_id IN (SELECT id FROM towers WHERE society_id = auth_society_id())
  );

-- ─── residents ─────────────────────────────────────────────────────

CREATE POLICY "residents_select" ON residents
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth_role() = 'admin'
    OR auth_role() = 'guard'
  );

CREATE POLICY "residents_insert" ON residents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "residents_update_admin" ON residents
  FOR UPDATE USING (auth_role() = 'admin');

CREATE POLICY "residents_delete_admin" ON residents
  FOR DELETE USING (auth_role() = 'admin');

-- ─── family_members ────────────────────────────────────────────────

CREATE POLICY "family_members_select" ON family_members
  FOR SELECT USING (
    resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
    OR auth_role() = 'admin'
  );

CREATE POLICY "family_members_manage" ON family_members
  FOR ALL USING (
    resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ─── vehicles ──────────────────────────────────────────────────────

CREATE POLICY "vehicles_select" ON vehicles
  FOR SELECT USING (
    resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
    OR auth_role() = 'admin'
    OR auth_role() = 'guard'
  );

CREATE POLICY "vehicles_manage" ON vehicles
  FOR ALL USING (
    resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ─── visitors ──────────────────────────────────────────────────────

CREATE POLICY "visitors_select" ON visitors
  FOR SELECT USING (society_id = auth_society_id());

CREATE POLICY "visitors_insert_resident" ON visitors
  FOR INSERT WITH CHECK (
    society_id = auth_society_id()
    AND (auth_role() = 'resident' OR auth_role() = 'admin')
  );

-- ─── visitor_passes ────────────────────────────────────────────────

CREATE POLICY "visitor_passes_select" ON visitor_passes
  FOR SELECT USING (
    flat_id = auth_flat_id()
    OR auth_role() = 'admin'
    OR auth_role() = 'guard'
  );

CREATE POLICY "visitor_passes_insert_resident" ON visitor_passes
  FOR INSERT WITH CHECK (
    flat_id = auth_flat_id()
    AND auth_role() = 'resident'
  );

CREATE POLICY "visitor_passes_update_guard" ON visitor_passes
  FOR UPDATE USING (auth_role() = 'guard' OR auth_role() = 'admin');

-- ─── visitor_logs ──────────────────────────────────────────────────

CREATE POLICY "visitor_logs_select" ON visitor_logs
  FOR SELECT USING (
    guard_id = auth.uid()
    OR auth_role() = 'admin'
    OR pass_id IN (
      SELECT id FROM visitor_passes WHERE flat_id = auth_flat_id()
    )
  );

CREATE POLICY "visitor_logs_insert_guard" ON visitor_logs
  FOR INSERT WITH CHECK (
    guard_id = auth.uid()
    AND auth_role() = 'guard'
  );

-- ─── domestic_staff ────────────────────────────────────────────────

CREATE POLICY "domestic_staff_select" ON domestic_staff
  FOR SELECT USING (society_id = auth_society_id());

CREATE POLICY "domestic_staff_manage" ON domestic_staff
  FOR ALL USING (
    society_id = auth_society_id()
    AND (auth_role() = 'resident' OR auth_role() = 'admin')
  );

-- ─── staff_attendance ──────────────────────────────────────────────

CREATE POLICY "staff_attendance_select" ON staff_attendance
  FOR SELECT USING (
    flat_id = auth_flat_id()
    OR auth_role() = 'admin'
    OR auth_role() = 'guard'
  );

CREATE POLICY "staff_attendance_insert_guard" ON staff_attendance
  FOR INSERT WITH CHECK (auth_role() = 'guard' OR auth_role() = 'admin');

-- ─── notices ───────────────────────────────────────────────────────

CREATE POLICY "notices_select" ON notices
  FOR SELECT USING (society_id = auth_society_id());

CREATE POLICY "notices_manage_admin" ON notices
  FOR ALL USING (auth_role() = 'admin' AND society_id = auth_society_id());

-- ─── complaints ────────────────────────────────────────────────────

CREATE POLICY "complaints_select" ON complaints
  FOR SELECT USING (
    flat_id = auth_flat_id()
    OR auth_role() = 'admin'
  );

CREATE POLICY "complaints_insert_resident" ON complaints
  FOR INSERT WITH CHECK (
    flat_id = auth_flat_id()
    AND auth_role() = 'resident'
  );

CREATE POLICY "complaints_update" ON complaints
  FOR UPDATE USING (
    flat_id = auth_flat_id()
    OR auth_role() = 'admin'
  );

-- ─── amenities ─────────────────────────────────────────────────────

CREATE POLICY "amenities_select" ON amenities
  FOR SELECT USING (society_id = auth_society_id());

CREATE POLICY "amenities_manage_admin" ON amenities
  FOR ALL USING (auth_role() = 'admin' AND society_id = auth_society_id());

-- ─── amenity_bookings ──────────────────────────────────────────────

CREATE POLICY "amenity_bookings_select" ON amenity_bookings
  FOR SELECT USING (
    resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
    OR auth_role() = 'admin'
  );

CREATE POLICY "amenity_bookings_insert_resident" ON amenity_bookings
  FOR INSERT WITH CHECK (
    resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
    AND auth_role() = 'resident'
  );

CREATE POLICY "amenity_bookings_cancel" ON amenity_bookings
  FOR UPDATE USING (
    resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())
    OR auth_role() = 'admin'
  );

-- ─── invoices ──────────────────────────────────────────────────────

CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (
    flat_id = auth_flat_id()
    OR auth_role() = 'admin'
  );

CREATE POLICY "invoices_insert_admin" ON invoices
  FOR INSERT WITH CHECK (auth_role() = 'admin');

CREATE POLICY "invoices_update_admin" ON invoices
  FOR UPDATE USING (auth_role() = 'admin');

-- ─── payments ──────────────────────────────────────────────────────

CREATE POLICY "payments_select" ON payments
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM invoices WHERE flat_id = auth_flat_id())
    OR auth_role() = 'admin'
  );

CREATE POLICY "payments_insert" ON payments
  FOR INSERT WITH CHECK (
    invoice_id IN (SELECT id FROM invoices WHERE flat_id = auth_flat_id())
    OR auth_role() = 'admin'
  );

-- ─── push_tokens ───────────────────────────────────────────────────

CREATE POLICY "push_tokens_manage_own" ON push_tokens
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "push_tokens_select_admin" ON push_tokens
  FOR SELECT USING (auth_role() = 'admin');
