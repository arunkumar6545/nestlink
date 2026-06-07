-- ══════════════════════════════════════════════════════════════════
-- Migration 011: Platform Announcements & Support Escalations
-- ══════════════════════════════════════════════════════════════════

-- ─── Platform Announcements ───────────────────────────────────────
-- Super admins can broadcast messages to all or specific societies

CREATE TABLE platform_announcements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body              TEXT NOT NULL CHECK (char_length(body) BETWEEN 5 AND 5000),
  type              TEXT NOT NULL DEFAULT 'info'
                      CHECK (type IN ('info', 'warning', 'maintenance')),
  target_society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
  -- NULL = broadcast to all societies
  sent_by           UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_target  ON platform_announcements(target_society_id);
CREATE INDEX idx_announcements_sent    ON platform_announcements(sent_at DESC);

ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;

-- Super admins can read/write all announcements
CREATE POLICY "ann_super_admin" ON platform_announcements
  FOR ALL USING (is_super_admin());

-- Society admins can read announcements targeted to their society OR to all
CREATE POLICY "ann_society_read" ON platform_announcements
  FOR SELECT USING (
    (target_society_id IS NULL OR target_society_id = auth_society_id())
    AND auth_role()::text IN ('admin', 'hoa_president', 'hoa_secretary', 'hoa_treasurer', 'hoa_member', 'resident')
  );

-- ─── Support Escalations ──────────────────────────────────────────
-- Society admins can escalate issues to Nestlink

CREATE TABLE support_escalations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  description TEXT CHECK (char_length(description) <= 2000),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_by  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_esc_society  ON support_escalations(society_id);
CREATE INDEX idx_esc_status   ON support_escalations(status, created_at DESC);
CREATE INDEX idx_esc_assigned ON support_escalations(assigned_to);

CREATE TRIGGER esc_updated_at
  BEFORE UPDATE ON support_escalations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE support_escalations ENABLE ROW LEVEL SECURITY;

-- Super admins see all escalations
CREATE POLICY "esc_super_admin" ON support_escalations
  FOR ALL USING (is_super_admin());

-- Society admins can create and view their own society's escalations
CREATE POLICY "esc_admin_select" ON support_escalations
  FOR SELECT USING (
    society_id = auth_society_id()
    AND auth_role()::text IN ('admin', 'hoa_president')
  );

CREATE POLICY "esc_admin_insert" ON support_escalations
  FOR INSERT WITH CHECK (
    society_id = auth_society_id()
    AND auth_role()::text IN ('admin', 'hoa_president')
    AND created_by = auth.uid()
  );
