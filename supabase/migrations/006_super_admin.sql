-- ══════════════════════════════════════════════════════════════════
-- Migration 006: Super Admin — Platform-level management
-- ══════════════════════════════════════════════════════════════════

-- ─── Enrich societies table ───────────────────────────────────────

ALTER TABLE societies
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trial', 'active', 'suspended', 'churned')),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- ─── Platform audit log ───────────────────────────────────────────
-- Tracks every action a super admin takes

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,  -- 'society' | 'user' | 'platform'
  target_id   UUID,
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor   ON platform_audit_log(actor_id);
CREATE INDEX idx_audit_target  ON platform_audit_log(target_id);
CREATE INDEX idx_audit_created ON platform_audit_log(created_at DESC);

-- Only super_admins can read the audit log
ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_super_admin_only" ON platform_audit_log
  FOR ALL USING (auth_role() = 'super_admin');

-- ─── Super admin RLS helper ───────────────────────────────────────

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Open societies SELECT for super_admin ────────────────────────
-- Super admins can read ALL societies

DROP POLICY IF EXISTS "Members can read own society" ON societies;
CREATE POLICY "Members can read own society" ON societies
  FOR SELECT USING (
    id IN (SELECT society_id FROM user_profiles WHERE id = auth.uid())
    OR admin_id = auth.uid()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Admins can update own society" ON societies;
CREATE POLICY "Admins can update own society" ON societies
  FOR UPDATE USING (
    admin_id = auth.uid()
    OR is_super_admin()
  );

-- Super admin can INSERT any society
DROP POLICY IF EXISTS "Admins can insert society" ON societies;
CREATE POLICY "Super admin or admin can insert society" ON societies
  FOR INSERT WITH CHECK (
    admin_id = auth.uid()
    OR is_super_admin()
  );

-- ─── Super admin can read/write ALL user_profiles ─────────────────

DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (
    id = auth.uid()
    OR auth_role() IN ('admin', 'guard')
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR auth_role() = 'admin'
    OR is_super_admin()
  );

-- ─── Platform-wide stats function ────────────────────────────────
-- Returns aggregate stats across all societies

CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  SELECT jsonb_build_object(
    'total_societies',    (SELECT COUNT(*) FROM societies),
    'active_societies',   (SELECT COUNT(*) FROM societies WHERE status = 'active'),
    'trial_societies',    (SELECT COUNT(*) FROM societies WHERE status = 'trial'),
    'suspended_societies',(SELECT COUNT(*) FROM societies WHERE status = 'suspended'),
    'total_users',        (SELECT COUNT(*) FROM user_profiles),
    'total_residents',    (SELECT COUNT(*) FROM user_profiles WHERE role = 'resident'),
    'total_admins',       (SELECT COUNT(*) FROM user_profiles WHERE role IN ('admin','super_admin')),
    'total_guards',       (SELECT COUNT(*) FROM user_profiles WHERE role = 'guard'),
    'new_societies_30d',  (SELECT COUNT(*) FROM societies WHERE created_at > NOW() - INTERVAL '30 days'),
    'new_users_30d',      (SELECT COUNT(*) FROM user_profiles WHERE created_at > NOW() - INTERVAL '30 days')
  ) INTO result;

  RETURN result;
END;
$$;

-- ─── Onboard society function ─────────────────────────────────────
-- Creates a society AND its first admin user in one transaction

CREATE OR REPLACE FUNCTION onboard_society(
  p_society_name    TEXT,
  p_address         TEXT,
  p_city            TEXT,
  p_state           TEXT,
  p_pincode         TEXT,
  p_total_units     INTEGER,
  p_admin_name      TEXT,
  p_admin_phone     TEXT,
  p_plan            TEXT DEFAULT 'trial'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_society_id   UUID;
  v_inv_id       UUID;
  v_actor_id     UUID := auth.uid();
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  -- Create society
  INSERT INTO societies (name, address, city, state, pincode, total_units, plan, status,
                         created_by, onboarded_at)
  VALUES (p_society_name, p_address, p_city, p_state, p_pincode, p_total_units,
          p_plan, 'trial', v_actor_id, NOW())
  RETURNING id INTO v_society_id;

  -- Create invitation for the society admin
  INSERT INTO invitations (society_id, invited_by, phone, name, role, status)
  VALUES (v_society_id, v_actor_id, p_admin_phone, p_admin_name, 'admin', 'pending')
  RETURNING id INTO v_inv_id;

  -- Log the action
  INSERT INTO platform_audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (v_actor_id, 'onboard_society', 'society', v_society_id,
    jsonb_build_object(
      'society_name', p_society_name,
      'admin_phone', p_admin_phone,
      'plan', p_plan
    ));

  RETURN jsonb_build_object(
    'society_id', v_society_id,
    'invitation_id', v_inv_id
  );
END;
$$;

-- ─── Suspend / reactivate society ────────────────────────────────

CREATE OR REPLACE FUNCTION set_society_status(
  p_society_id UUID,
  p_status     TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  UPDATE societies SET status = p_status, updated_at = NOW()
  WHERE id = p_society_id;

  INSERT INTO platform_audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), 'set_society_status', 'society', p_society_id,
    jsonb_build_object('new_status', p_status));
END;
$$;

-- ─── Promote user to super_admin ─────────────────────────────────
-- Can only be called by an existing super_admin or via SQL directly

CREATE OR REPLACE FUNCTION promote_to_super_admin(p_phone TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Allow first bootstrap (no existing super admin) OR existing super admin calling it
  IF (SELECT COUNT(*) FROM user_profiles WHERE role = 'super_admin') > 0
     AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only existing super admins can promote others';
  END IF;

  UPDATE user_profiles SET role = 'super_admin', updated_at = NOW()
  WHERE phone = p_phone;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No user found with phone %', p_phone;
  END IF;
END;
$$;

-- ─── Bootstrap comment ───────────────────────────────────────────
-- To create the first super admin, run in Supabase SQL editor:
--   SELECT promote_to_super_admin('+91XXXXXXXXXX');
-- Or seed it directly:
--   UPDATE user_profiles SET role = 'super_admin' WHERE phone = '+91XXXXXXXXXX';
