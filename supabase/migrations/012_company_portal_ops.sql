-- ══════════════════════════════════════════════════════════════════
-- Migration 012: Company Portal Operations Tables
-- ══════════════════════════════════════════════════════════════════

-- ─── 1. flats: add area_sqft ──────────────────────────────────────
ALTER TABLE flats ADD COLUMN IF NOT EXISTS area_sqft INTEGER;

-- ─── 2. parking_lots ──────────────────────────────────────────────
-- A flat can have multiple parking slots

CREATE TABLE parking_lots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id     UUID NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  society_id  UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  slot_number TEXT NOT NULL,
  lot_type    TEXT NOT NULL DEFAULT 'open'
                CHECK (lot_type IN ('open', 'covered', 'basement')),
  is_assigned BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (society_id, slot_number)
);

CREATE INDEX idx_parking_lots_flat     ON parking_lots(flat_id);
CREATE INDEX idx_parking_lots_society  ON parking_lots(society_id);

ALTER TABLE parking_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parking_super_admin"   ON parking_lots FOR ALL USING (is_super_admin());
CREATE POLICY "parking_society_read"  ON parking_lots FOR SELECT USING (society_id = auth_society_id());
CREATE POLICY "parking_admin_write"   ON parking_lots FOR INSERT WITH CHECK (
  society_id = auth_society_id() AND auth_role()::text IN ('admin','super_admin')
);

-- ─── 3. platform_incidents ────────────────────────────────────────

CREATE TABLE platform_incidents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description       TEXT,
  severity          TEXT NOT NULL DEFAULT 'info'
                      CHECK (severity IN ('info', 'degraded', 'outage')),
  status            TEXT NOT NULL DEFAULT 'investigating'
                      CHECK (status IN ('investigating','identified','monitoring','resolved')),
  target_society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_status   ON platform_incidents(status);
CREATE INDEX idx_incidents_severity ON platform_incidents(severity);

CREATE TRIGGER incidents_updated_at
  BEFORE UPDATE ON platform_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE platform_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_super_admin" ON platform_incidents FOR ALL USING (is_super_admin());
CREATE POLICY "incidents_society_read" ON platform_incidents
  FOR SELECT USING (
    target_society_id IS NULL OR target_society_id = auth_society_id()
  );

-- ─── 4. onboarding_checklists ─────────────────────────────────────

CREATE TABLE onboarding_checklists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id   UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  step         TEXT NOT NULL,
  description  TEXT,
  completed_at TIMESTAMPTZ,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (society_id, step)
);

CREATE INDEX idx_checklist_society ON onboarding_checklists(society_id);

ALTER TABLE onboarding_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_super_admin"  ON onboarding_checklists FOR ALL USING (is_super_admin());
CREATE POLICY "checklist_society_read" ON onboarding_checklists
  FOR SELECT USING (society_id = auth_society_id());
CREATE POLICY "checklist_admin_update" ON onboarding_checklists
  FOR UPDATE USING (
    society_id = auth_society_id() AND auth_role()::text IN ('admin','hoa_president')
  );

-- Auto-populate checklist when a society is onboarded (via trigger)
CREATE OR REPLACE FUNCTION create_onboarding_checklist(p_society_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO onboarding_checklists (society_id, step, description, sort_order)
  VALUES
    (p_society_id, 'admin_signed_in',      'Society admin has signed in for the first time', 1),
    (p_society_id, 'first_unit_added',     'At least one unit (flat) has been added',         2),
    (p_society_id, 'first_resident',       'First resident has been invited or joined',        3),
    (p_society_id, 'first_notice_posted',  'First notice has been posted to residents',        4),
    (p_society_id, 'first_complaint_filed','First maintenance complaint has been filed',       5),
    (p_society_id, 'payment_configured',   'Maintenance invoice has been generated',           6)
  ON CONFLICT (society_id, step) DO NOTHING;
END;
$$;

-- ─── 5. subscription_invoices ─────────────────────────────────────

CREATE TABLE subscription_invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id  UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  period      TEXT NOT NULL,          -- YYYY-MM e.g. '2026-06'
  plan        TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','paid','overdue')),
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (society_id, period)
);

CREATE INDEX idx_sub_invoices_society ON subscription_invoices(society_id);
CREATE INDEX idx_sub_invoices_status  ON subscription_invoices(status, due_date);

CREATE TRIGGER sub_invoices_updated_at
  BEFORE UPDATE ON subscription_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_inv_super_admin"    ON subscription_invoices FOR ALL USING (is_super_admin());
CREATE POLICY "sub_inv_society_read"   ON subscription_invoices
  FOR SELECT USING (society_id = auth_society_id());

-- ─── 6. platform_settings ─────────────────────────────────────────

CREATE TABLE platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_super_admin" ON platform_settings FOR ALL USING (is_super_admin());
CREATE POLICY "settings_read_all"    ON platform_settings FOR SELECT USING (true);

-- Seed default settings
INSERT INTO platform_settings (key, value) VALUES
  ('maintenance_mode',    'false'::jsonb),
  ('maintenance_message', '"Nestlink is under scheduled maintenance. We will be back shortly."'::jsonb),
  ('default_trial_days',  '30'::jsonb),
  ('allow_new_signups',   'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── 7. bulk_upload_units RPC ─────────────────────────────────────
-- Accepts a JSONB array of unit rows from CSV, inserts towers/flats/parking/invitations

CREATE OR REPLACE FUNCTION bulk_upload_units(
  p_society_id UUID,
  p_rows       JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r              JSONB;
  v_tower_id     UUID;
  v_flat_id      UUID;
  v_inserted     INT := 0;
  v_skipped      INT := 0;
  v_errors       TEXT[] := '{}';
  v_actor_id     UUID := auth.uid();
  v_slot         TEXT;
  v_slots        TEXT[];
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      -- Upsert tower
      INSERT INTO towers (society_id, name, floors)
      VALUES (p_society_id, r->>'tower_name', COALESCE((r->>'floors')::int, 10))
      ON CONFLICT DO NOTHING;

      SELECT id INTO v_tower_id FROM towers
      WHERE society_id = p_society_id AND name = r->>'tower_name';

      -- Insert flat (skip if already exists)
      IF EXISTS (SELECT 1 FROM flats WHERE tower_id = v_tower_id AND number = r->>'unit_number') THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO flats (tower_id, floor, number, type, area_sqft)
      VALUES (
        v_tower_id,
        (r->>'floor')::int,
        r->>'unit_number',
        COALESCE(r->>'unit_type', '2BHK'),
        CASE WHEN r->>'area_sqft' IS NOT NULL AND r->>'area_sqft' <> ''
             THEN (r->>'area_sqft')::int ELSE NULL END
      )
      RETURNING id INTO v_flat_id;

      -- Insert parking slots (comma-separated)
      IF r->>'parking_slots' IS NOT NULL AND r->>'parking_slots' <> '' THEN
        v_slots := string_to_array(r->>'parking_slots', ',');
        FOREACH v_slot IN ARRAY v_slots
        LOOP
          v_slot := trim(v_slot);
          IF v_slot <> '' THEN
            INSERT INTO parking_lots (flat_id, society_id, slot_number)
            VALUES (v_flat_id, p_society_id, v_slot)
            ON CONFLICT (society_id, slot_number) DO UPDATE
              SET flat_id = v_flat_id;
          END IF;
        END LOOP;
      END IF;

      -- Create invitation for owner if phone provided
      IF r->>'owner_phone' IS NOT NULL AND r->>'owner_phone' <> '' THEN
        INSERT INTO invitations (society_id, invited_by, phone, name, role, flat_id)
        VALUES (
          p_society_id, v_actor_id,
          r->>'owner_phone',
          COALESCE(r->>'owner_name', 'Resident'),
          'resident',
          v_flat_id
        )
        ON CONFLICT DO NOTHING;
      END IF;

      v_inserted := v_inserted + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors,
        'Row ' || (r->>'unit_number') || ': ' || SQLERRM);
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  -- Update checklist
  UPDATE onboarding_checklists
  SET completed_at = NOW()
  WHERE society_id = p_society_id AND step = 'first_unit_added'
    AND completed_at IS NULL AND v_inserted > 0;

  -- Audit log
  INSERT INTO platform_audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (v_actor_id, 'bulk_upload_units', 'society', p_society_id,
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped));

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped',  v_skipped,
    'errors',   to_jsonb(v_errors)
  );
END;
$$;

-- ─── 8. Seed onboarding checklists for existing societies ─────────
DO $$
DECLARE v_soc RECORD;
BEGIN
  FOR v_soc IN SELECT id FROM societies LOOP
    PERFORM create_onboarding_checklist(v_soc.id);
  END LOOP;
END $$;
