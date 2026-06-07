-- ══════════════════════════════════════════════════════════════════
-- Migration 009: Direct Messages, Member Posts & Calls
-- ══════════════════════════════════════════════════════════════════

-- ─── Conversations (1-on-1 DM threads) ───────────────────────────

CREATE TABLE conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Always store participant1_id < participant2_id for uniqueness
  participant1_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  participant2_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_message_at  TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_ordered CHECK (participant1_id < participant2_id),
  CONSTRAINT conversations_unique  UNIQUE (participant1_id, participant2_id)
);

CREATE INDEX idx_conversations_p1 ON conversations(participant1_id, last_message_at DESC);
CREATE INDEX idx_conversations_p2 ON conversations(participant2_id, last_message_at DESC);

-- ─── Direct Messages ──────────────────────────────────────────────

CREATE TABLE direct_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  message_type    TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','call')),
  media_url       TEXT,
  reply_to_id     UUID REFERENCES direct_messages(id) ON DELETE SET NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_conversation ON direct_messages(conversation_id, created_at);

-- Trigger: update conversation preview on new message
CREATE OR REPLACE FUNCTION update_conversation_preview()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 60)
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversation_preview
  AFTER INSERT ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_preview();

-- RPC: Get or create a conversation between current user and another
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  me   UUID := auth.uid();
  p1   UUID := LEAST(me, other_user_id);
  p2   UUID := GREATEST(me, other_user_id);
  cid  UUID;
BEGIN
  SELECT id INTO cid FROM conversations
    WHERE participant1_id = p1 AND participant2_id = p2;

  IF NOT FOUND THEN
    INSERT INTO conversations(participant1_id, participant2_id)
    VALUES (p1, p2)
    RETURNING id INTO cid;
  END IF;

  RETURN cid;
END;
$$;

-- ─── Member Posts ─────────────────────────────────────────────────

CREATE TABLE member_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id     UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content        TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  media_url      TEXT,
  media_type     TEXT CHECK (media_type IN ('image','video')),
  likes_count    INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_society  ON member_posts(society_id, created_at DESC);
CREATE INDEX idx_posts_author   ON member_posts(author_id, created_at DESC);

CREATE TABLE post_likes (
  post_id    UUID NOT NULL REFERENCES member_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES member_posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync likes_count and comments_count
CREATE OR REPLACE FUNCTION sync_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE member_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE member_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION sync_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE member_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE member_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_likes     AFTER INSERT OR DELETE ON post_likes    FOR EACH ROW EXECUTE FUNCTION sync_post_likes_count();
CREATE TRIGGER trg_post_comments  AFTER INSERT OR DELETE ON post_comments FOR EACH ROW EXECUTE FUNCTION sync_post_comments_count();
CREATE TRIGGER member_posts_updated_at BEFORE UPDATE ON member_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Call Logs ────────────────────────────────────────────────────

CREATE TABLE call_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  callee_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  call_type        TEXT NOT NULL CHECK (call_type IN ('voice','video')),
  status           TEXT NOT NULL DEFAULT 'ringing'
                    CHECK (status IN ('ringing','accepted','rejected','missed','ended')),
  -- WebRTC SDP signaling stored in DB for reliable exchange
  sdp_offer        TEXT,
  sdp_answer       TEXT,
  duration_seconds INT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ
);

CREATE INDEX idx_call_logs_callee  ON call_logs(callee_id, started_at DESC);
CREATE INDEX idx_call_logs_caller  ON call_logs(caller_id, started_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────

ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs         ENABLE ROW LEVEL SECURITY;

-- conversations: visible/writable only by participants
CREATE POLICY "conv_select" ON conversations FOR SELECT
  USING (participant1_id = auth.uid() OR participant2_id = auth.uid() OR is_super_admin());

CREATE POLICY "conv_insert" ON conversations FOR INSERT
  WITH CHECK (participant1_id = auth.uid() OR participant2_id = auth.uid());

CREATE POLICY "conv_update" ON conversations FOR UPDATE
  USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- direct_messages
CREATE POLICY "dm_select" ON direct_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant1_id = auth.uid() OR participant2_id = auth.uid()
    ) OR is_super_admin()
  );

CREATE POLICY "dm_insert" ON direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE participant1_id = auth.uid() OR participant2_id = auth.uid()
    )
  );

CREATE POLICY "dm_update" ON direct_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- member_posts: society members can read; author can write
CREATE POLICY "posts_select" ON member_posts FOR SELECT
  USING (society_id = auth_society_id() OR is_super_admin());

CREATE POLICY "posts_insert" ON member_posts FOR INSERT
  WITH CHECK (society_id = auth_society_id() AND author_id = auth.uid());

CREATE POLICY "posts_update" ON member_posts FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "posts_delete" ON member_posts FOR DELETE
  USING (author_id = auth.uid() OR is_super_admin());

-- post_likes
CREATE POLICY "likes_select" ON post_likes FOR SELECT
  USING (post_id IN (SELECT id FROM member_posts WHERE society_id = auth_society_id()) OR is_super_admin());

CREATE POLICY "likes_insert" ON post_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete" ON post_likes FOR DELETE
  USING (user_id = auth.uid());

-- post_comments
CREATE POLICY "comments_select" ON post_comments FOR SELECT
  USING (post_id IN (SELECT id FROM member_posts WHERE society_id = auth_society_id()) OR is_super_admin());

CREATE POLICY "comments_insert" ON post_comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "comments_delete" ON post_comments FOR DELETE
  USING (author_id = auth.uid() OR is_super_admin());

-- call_logs
CREATE POLICY "calls_select" ON call_logs FOR SELECT
  USING (caller_id = auth.uid() OR callee_id = auth.uid() OR is_super_admin());

CREATE POLICY "calls_insert" ON call_logs FOR INSERT
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "calls_update" ON call_logs FOR UPDATE
  USING (caller_id = auth.uid() OR callee_id = auth.uid());
