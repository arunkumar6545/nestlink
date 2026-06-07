-- ══════════════════════════════════════════════════════════════════
-- Migration 008: Groups & Group Chat
-- ══════════════════════════════════════════════════════════════════

-- ─── Groups ───────────────────────────────────────────────────────

CREATE TABLE groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id   UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description  TEXT CHECK (char_length(description) <= 500),
  purpose      TEXT NOT NULL DEFAULT 'general'
                CHECK (purpose IN ('general','sports','cultural','welfare','emergency','parents','other')),
  type         TEXT NOT NULL DEFAULT 'invite_only'
                CHECK (type IN ('open','invite_only','request_to_join')),
  avatar_url   TEXT,
  created_by   UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  member_count INTEGER NOT NULL DEFAULT 1,
  is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_society   ON groups(society_id);
CREATE INDEX idx_groups_created   ON groups(created_at DESC);

-- ─── Group Members ────────────────────────────────────────────────

CREATE TABLE group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user  ON group_members(user_id);

-- ─── Group Invitations ────────────────────────────────────────────

CREATE TABLE group_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  invitee_id  UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  invitee_phone TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','revoked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_group_invitations_group    ON group_invitations(group_id);
CREATE INDEX idx_group_invitations_invitee  ON group_invitations(invitee_id);

-- ─── Join Requests ────────────────────────────────────────────────

CREATE TABLE group_join_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  message     TEXT CHECK (char_length(message) <= 200),
  status      TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_join_requests_group ON group_join_requests(group_id);

-- ─── Group Messages ───────────────────────────────────────────────

CREATE TABLE group_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  message_type TEXT NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text','image','file','system')),
  media_url    TEXT,
  reply_to_id  UUID REFERENCES group_messages(id) ON DELETE SET NULL,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_messages_group   ON group_messages(group_id, created_at DESC);
CREATE INDEX idx_group_messages_sender  ON group_messages(sender_id);

-- ─── Trigger: update member_count ────────────────────────────────

CREATE OR REPLACE FUNCTION sync_group_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_group_member_count
  AFTER INSERT OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION sync_group_member_count();

-- ─── Trigger: auto-add creator as admin ──────────────────────────

CREATE OR REPLACE FUNCTION auto_add_group_creator()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO group_members(group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_group_creator
  AFTER INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION auto_add_group_creator();

-- ─── Trigger: updated_at ─────────────────────────────────────────

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER group_messages_updated_at
  BEFORE UPDATE ON group_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of a group?
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is user an admin of a group?
CREATE OR REPLACE FUNCTION is_group_admin(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- groups: society members can see all groups in their society
CREATE POLICY "groups_select" ON groups
  FOR SELECT USING (society_id = auth_society_id() OR is_super_admin());

CREATE POLICY "groups_insert" ON groups
  FOR INSERT WITH CHECK (
    society_id = auth_society_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "groups_update" ON groups
  FOR UPDATE USING (is_group_admin(id) OR is_super_admin());

-- group_members: visible to society members, writable by group admins
CREATE POLICY "gm_select" ON group_members
  FOR SELECT USING (
    group_id IN (SELECT id FROM groups WHERE society_id = auth_society_id())
    OR is_super_admin()
  );

CREATE POLICY "gm_insert" ON group_members
  FOR INSERT WITH CHECK (
    is_group_admin(group_id)
    OR (user_id = auth.uid())   -- self-join for open groups
    OR is_super_admin()
  );

CREATE POLICY "gm_delete" ON group_members
  FOR DELETE USING (
    user_id = auth.uid()          -- leave group
    OR is_group_admin(group_id)   -- admin removes member
    OR is_super_admin()
  );

-- group_invitations
CREATE POLICY "gi_select" ON group_invitations
  FOR SELECT USING (
    invitee_id = auth.uid()
    OR is_group_member(group_id)
    OR is_super_admin()
  );

CREATE POLICY "gi_insert" ON group_invitations
  FOR INSERT WITH CHECK (
    is_group_admin(group_id)
    OR is_super_admin()
  );

CREATE POLICY "gi_update" ON group_invitations
  FOR UPDATE USING (
    invitee_id = auth.uid()         -- accept/decline
    OR is_group_admin(group_id)     -- revoke
    OR is_super_admin()
  );

-- group_join_requests
CREATE POLICY "gjr_select" ON group_join_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_group_admin(group_id)
    OR is_super_admin()
  );

CREATE POLICY "gjr_insert" ON group_join_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "gjr_update" ON group_join_requests
  FOR UPDATE USING (
    is_group_admin(group_id)
    OR is_super_admin()
  );

-- group_messages: only members can read & write
CREATE POLICY "gmsg_select" ON group_messages
  FOR SELECT USING (is_group_member(group_id) OR is_super_admin());

CREATE POLICY "gmsg_insert" ON group_messages
  FOR INSERT WITH CHECK (
    is_group_member(group_id)
    AND sender_id = auth.uid()
  );

CREATE POLICY "gmsg_update" ON group_messages
  FOR UPDATE USING (sender_id = auth.uid() OR is_group_admin(group_id));

-- ─── Enable Realtime on group_messages ───────────────────────────
-- Run this in Supabase dashboard → Database → Replication, or via:
-- ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE group_join_requests;
-- ALTER PUBLICATION supabase_realtime ADD TABLE group_invitations;
