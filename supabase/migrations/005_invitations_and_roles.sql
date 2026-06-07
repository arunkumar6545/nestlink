-- ══════════════════════════════════════════════════════════════════
-- Migration 005: Invitations system + role management
-- ══════════════════════════════════════════════════════════════════

-- Add super_admin role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ─── Invitations ──────────────────────────────────────────────────
-- Admin pre-registers users by phone + role. When they sign up via
-- OTP their profile is auto-populated from this record.

CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  role        user_role NOT NULL DEFAULT 'resident',
  flat_id     UUID REFERENCES flats(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- filled in on first login
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_phone    ON invitations(phone);
CREATE INDEX idx_invitations_society  ON invitations(society_id);
CREATE INDEX idx_invitations_user_id  ON invitations(user_id);

-- ─── RLS for invitations ──────────────────────────────────────────

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admins of a society can read all invitations for that society
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (
    society_id = auth_society_id()
    AND auth_role() IN ('admin', 'super_admin')
  );

-- Admins can insert invitations for their society
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (
    society_id = auth_society_id()
    AND auth_role() IN ('admin', 'super_admin')
  );

-- Admins can update (revoke) invitations
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (
    society_id = auth_society_id()
    AND auth_role() IN ('admin', 'super_admin')
  );

-- Users can read their own invitation (by user_id) to accept it
CREATE POLICY "invitations_self_select" ON invitations
  FOR SELECT USING (user_id = auth.uid());

-- The auto-profile function (SECURITY DEFINER) needs to read invitations by phone
-- We grant service-level access via the trigger below.

-- ─── Auto-profile trigger ─────────────────────────────────────────
-- When a new auth user signs in for the first time, look up pending
-- invitation by phone and auto-create their user_profile.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv invitations%ROWTYPE;
  raw_phone TEXT;
BEGIN
  -- Extract phone from auth metadata (Supabase phone OTP sets phone on auth.users)
  raw_phone := NEW.phone;

  -- Try to find a pending invitation matching this phone
  SELECT * INTO inv
  FROM invitations
  WHERE phone = raw_phone
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Create profile from invitation
    INSERT INTO user_profiles (id, name, phone, role, society_id)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(inv.name, ''), 'New User'),
      raw_phone,
      inv.role,
      inv.society_id
    )
    ON CONFLICT (id) DO NOTHING;

    -- Link invitation to this user
    UPDATE invitations SET user_id = NEW.id, status = 'accepted'
    WHERE id = inv.id;

    -- Auto-add to residents if flat assigned
    IF inv.flat_id IS NOT NULL THEN
      INSERT INTO residents (flat_id, user_id, type, approved_at)
      VALUES (inv.flat_id, NEW.id, 'owner', NOW())
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- No invitation found — create a minimal profile (role=resident, no society)
    -- The user will see an "awaiting approval" screen until admin assigns them
    INSERT INTO user_profiles (id, name, phone, role, society_id)
    VALUES (NEW.id, 'New User', COALESCE(raw_phone, ''), 'resident', NULL)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Role management helper ────────────────────────────────────────
-- Admins can update the role of users within their society

CREATE OR REPLACE FUNCTION assign_role(
  target_user_id UUID,
  new_role user_role
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only admins/super_admins can call this
  IF auth_role() NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;

  -- Admins can only manage users in their own society
  UPDATE user_profiles
  SET role = new_role, updated_at = NOW()
  WHERE id = target_user_id
    AND society_id = auth_society_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in your society';
  END IF;
END;
$$;
