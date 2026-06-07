-- ══════════════════════════════════════════════════════════════════
-- Migration 010: HOA Roles, Marketplace & Document Vault
-- ══════════════════════════════════════════════════════════════════

-- ─── Extend user_role enum ────────────────────────────────────────
-- Society HOA (elected committee) roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hoa_president';   -- Head of HOA, near-admin powers
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hoa_secretary';   -- Records, notices, complaints
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hoa_treasurer';   -- Finances, invoices
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hoa_member';      -- General committee member

-- ─── HOA helper: any committee/admin role? ────────────────────────
CREATE OR REPLACE FUNCTION is_hoa_or_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','hoa_president','hoa_secretary','hoa_treasurer','hoa_member')
  );
$$;

-- ─── Society Documents (Document Vault) ──────────────────────────

CREATE TABLE society_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  description TEXT CHECK (char_length(description) <= 500),
  category    TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN (
                 'minutes','bylaws','financial','legal',
                 'maintenance','notice','plans','other'
               )),
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_size   BIGINT,          -- bytes, optional
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = all residents, FALSE = HOA only
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_society  ON society_documents(society_id, created_at DESC);
CREATE INDEX idx_docs_category ON society_documents(society_id, category);

CREATE TRIGGER docs_updated_at
  BEFORE UPDATE ON society_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Marketplace Listings ─────────────────────────────────────────

CREATE TABLE marketplace_listings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description TEXT CHECK (char_length(description) <= 1000),
  price       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_free     BOOLEAN NOT NULL DEFAULT FALSE,
  category    TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN (
                 'furniture','electronics','vehicle','appliance',
                 'books','kids','clothing','property','services','other'
               )),
  condition   TEXT NOT NULL DEFAULT 'good'
               CHECK (condition IN ('new','like_new','good','fair')),
  images      TEXT[] NOT NULL DEFAULT '{}',   -- array of image URLs
  status      TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','sold','withdrawn')),
  views_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_society  ON marketplace_listings(society_id, created_at DESC);
CREATE INDEX idx_market_seller   ON marketplace_listings(seller_id);
CREATE INDEX idx_market_status   ON marketplace_listings(society_id, status, category);

CREATE TRIGGER market_updated_at
  BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Marketplace: saved/wishlist ─────────────────────────────────

CREATE TABLE listing_saves (
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_id, user_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────

ALTER TABLE society_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_saves        ENABLE ROW LEVEL SECURITY;

-- Documents: public docs visible to all society members; private docs only HOA+admin
CREATE POLICY "docs_select" ON society_documents FOR SELECT
  USING (
    (society_id = auth_society_id() AND is_public = TRUE)
    OR (society_id = auth_society_id() AND is_hoa_or_admin())
    OR is_super_admin()
  );

CREATE POLICY "docs_insert" ON society_documents FOR INSERT
  WITH CHECK (society_id = auth_society_id() AND is_hoa_or_admin());

CREATE POLICY "docs_update" ON society_documents FOR UPDATE
  USING (
    (uploaded_by = auth.uid() AND is_hoa_or_admin())
    OR auth.uid() IN (SELECT id FROM user_profiles WHERE society_id = auth_society_id() AND role IN ('admin','hoa_president'))
    OR is_super_admin()
  );

CREATE POLICY "docs_delete" ON society_documents FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM user_profiles WHERE society_id = auth_society_id() AND role IN ('admin','hoa_president'))
    OR is_super_admin()
  );

-- Marketplace: any society member can view active listings; only seller manages theirs
CREATE POLICY "market_select" ON marketplace_listings FOR SELECT
  USING (society_id = auth_society_id() OR is_super_admin());

CREATE POLICY "market_insert" ON marketplace_listings FOR INSERT
  WITH CHECK (society_id = auth_society_id() AND seller_id = auth.uid());

CREATE POLICY "market_update" ON marketplace_listings FOR UPDATE
  USING (
    seller_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM user_profiles WHERE society_id = auth_society_id() AND role IN ('admin','hoa_president'))
    OR is_super_admin()
  );

CREATE POLICY "market_delete" ON marketplace_listings FOR DELETE
  USING (seller_id = auth.uid() OR is_super_admin());

-- Listing saves
CREATE POLICY "saves_select" ON listing_saves FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "saves_insert" ON listing_saves FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "saves_delete" ON listing_saves FOR DELETE USING (user_id = auth.uid());

-- ─── Role reference view (used by HOA Roles page) ─────────────────
-- Just a comment; the permissions are enforced by RLS, not a DB view.
-- 
-- ROLE PERMISSIONS REFERENCE:
--
-- admin           │ Full platform access for the society
-- hoa_president   │ Near-admin: manage residents, notices, complaints, invoices,
--                 │ amenities, guards, assign HOA roles, document vault
-- hoa_secretary   │ Residents (view), notices (manage), complaints (manage),
--                 │ document vault (manage), groups
-- hoa_treasurer   │ Invoices (manage), financial reports, document vault (view)
-- hoa_member      │ Dashboard (view), notices (view), complaints (view),
--                 │ document vault (view), groups, members, messages
-- resident        │ Home, visitors, complaints (own), notices, payments,
--                 │ amenities, staff, groups, members, messages, marketplace
-- guard           │ QR scanner, visitor logs
-- staff           │ Task assignments (future)
