-- ══════════════════════════════════════════════════════════════════
-- Nestlink — Local Development Seed
-- Runs after all migrations as the postgres role.
-- ══════════════════════════════════════════════════════════════════

-- ─── Fix handle_new_user for email-based auth ─────────────────────
-- Email-only users need a unique phone placeholder so the NOT NULL
-- UNIQUE constraint on user_profiles.phone doesn't fail.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv           invitations%ROWTYPE;
  raw_phone     TEXT;
  profile_phone TEXT;
BEGIN
  raw_phone := NEW.phone;

  -- For email-only users generate a unique, stable placeholder
  profile_phone := COALESCE(
    NULLIF(TRIM(raw_phone), ''),
    'email:' || COALESCE(NEW.email, NEW.id::text)
  );

  IF raw_phone IS NOT NULL AND TRIM(raw_phone) <> '' THEN
    SELECT * INTO inv
    FROM invitations
    WHERE phone = raw_phone
      AND status = 'pending'
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    INSERT INTO user_profiles (id, name, phone, email, role, society_id)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(inv.name, ''), 'New User'),
      profile_phone, NEW.email, inv.role, inv.society_id
    )
    ON CONFLICT (id) DO NOTHING;

    UPDATE invitations SET user_id = NEW.id, status = 'accepted' WHERE id = inv.id;

    IF inv.flat_id IS NOT NULL THEN
      INSERT INTO residents (flat_id, user_id, type, approved_at)
      VALUES (inv.flat_id, NEW.id, 'owner', NOW())
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    INSERT INTO user_profiles (id, name, phone, email, role, society_id)
    VALUES (NEW.id, 'New User', profile_phone, NEW.email, 'resident', NULL)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Default CEO Super Admin Account ─────────────────────────────
-- Default credentials — CHANGE IN PRODUCTION!
--   Email   : ceo@nestlink.in
--   Password: Nestlink@2024

DO $$
DECLARE
  ceo_id    UUID := '00000000-0000-0000-0000-000000000099';
  ceo_email TEXT := 'ceo@nestlink.in';
  ceo_pass  TEXT := 'Nestlink@2024';
  ceo_phone TEXT := '+910000000000';
BEGIN

  -- Remove any duplicate email entry with a different id (prevents constraint violation)
  DELETE FROM auth.users WHERE email = ceo_email AND id != ceo_id;
  DELETE FROM user_profiles WHERE phone = ceo_phone AND id != ceo_id;

  -- ── auth.users ────────────────────────────────────────────────
  -- The on_auth_user_created trigger fires on INSERT (not on
  -- ON CONFLICT DO UPDATE), creating a minimal profile.
  -- We immediately upsert the real profile after.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    is_sso_user, is_anonymous, deleted_at
  ) VALUES (
    ceo_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    ceo_email,
    crypt(ceo_pass, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Nestlink CEO","full_name":"Nestlink CEO"}'::jsonb,
    NOW(), NOW(),
    false, false, NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = crypt(ceo_pass, gen_salt('bf')),
        email              = ceo_email,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
        updated_at         = NOW();

  -- ── auth.identities (required for signInWithPassword) ─────────
  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    ceo_id,
    ceo_email,
    ceo_id,
    jsonb_build_object(
      'sub',            ceo_id::text,
      'email',          ceo_email,
      'email_verified', true,
      'provider',       'email'
    ),
    'email',
    NOW(), NOW(), NOW()
  )
  ON CONFLICT (provider_id, provider) DO UPDATE
    SET identity_data = jsonb_build_object(
          'sub',            ceo_id::text,
          'email',          ceo_email,
          'email_verified', true,
          'provider',       'email'
        ),
        updated_at = NOW();

  -- ── user_profiles ────────────────────────────────────────────
  -- The trigger may have inserted a row with phone='email:ceo@nestlink.in'
  -- and role='resident'. Upsert on id to correct it.
  INSERT INTO user_profiles (id, name, phone, email, role, society_id)
  VALUES (ceo_id, 'Nestlink CEO', ceo_phone, ceo_email, 'super_admin', NULL)
  ON CONFLICT (id) DO UPDATE
    SET name       = 'Nestlink CEO',
        phone      = ceo_phone,
        email      = ceo_email,
        role       = 'super_admin',
        updated_at = NOW();

END $$;

-- ─── Sample society data ──────────────────────────────────────────
INSERT INTO societies (id, name, address, settings_json) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Green Valley Society', '12, Green Valley Road, Bangalore 560078',
   '{"maintenance_amount":2500,"late_fee_percent":2}')
ON CONFLICT DO NOTHING;

INSERT INTO towers (id, society_id, name, floors) VALUES
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Tower A',10),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Tower B',12),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Tower C',8)
ON CONFLICT DO NOTHING;

INSERT INTO flats (id, tower_id, floor, number, type) VALUES
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'A-101','2BHK'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',1,'A-102','3BHK'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',2,'A-201','2BHK'),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',2,'A-202','1BHK'),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',3,'A-301','3BHK'),
  ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002',1,'B-101','2BHK'),
  ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000002',1,'B-102','2BHK'),
  ('20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000003',1,'C-101','3BHK')
ON CONFLICT DO NOTHING;

INSERT INTO amenities (id, society_id, name, capacity, open_time, close_time, slots_json) VALUES
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Swimming Pool',15,'06:00','21:00',
   '[{"start":"06:00","end":"09:00","max_bookings":5},{"start":"16:00","end":"19:00","max_bookings":8}]'),
  ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Gym',20,'05:00','23:00',
   '[{"start":"05:00","end":"09:00","max_bookings":10},{"start":"16:00","end":"20:00","max_bookings":15}]'),
  ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Clubhouse',50,'08:00','22:00',
   '[{"start":"08:00","end":"12:00","max_bookings":1},{"start":"17:00","end":"22:00","max_bookings":1}]')
ON CONFLICT DO NOTHING;
