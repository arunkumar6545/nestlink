-- Migration 013: Add is_banned and last_seen_at to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_banned   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Index for banning queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_banned ON user_profiles(is_banned) WHERE is_banned = true;
