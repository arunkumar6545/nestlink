-- ─── Migration: Multi-tenancy & society enrichment ──────────────────────────
-- Adds admin_id, location fields, plan, logo_url to societies.
-- Adds state/pincode to support Create Society form.

ALTER TABLE societies
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pincode TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_units INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise'));

-- Index for admin lookup (multi-society admin)
CREATE INDEX IF NOT EXISTS idx_societies_admin_id ON societies(admin_id);

-- ─── RLS update: allow admin to create societies ──────────────────────────────

-- Anyone can insert a society if they will be the admin_id = auth.uid()
CREATE POLICY IF NOT EXISTS "Admins can insert society" ON societies
  FOR INSERT
  WITH CHECK (admin_id = auth.uid());

-- Admin can update/delete their own societies
CREATE POLICY IF NOT EXISTS "Admins can update own society" ON societies
  FOR UPDATE
  USING (admin_id = auth.uid());

-- All users can read societies they belong to (via user_profiles.society_id)
-- The existing read policy should cover this; add fallback just in case
CREATE POLICY IF NOT EXISTS "Members can read own society" ON societies
  FOR SELECT
  USING (
    id IN (
      SELECT society_id FROM user_profiles WHERE id = auth.uid()
    )
    OR admin_id = auth.uid()
  );
