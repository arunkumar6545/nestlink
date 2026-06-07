-- ══════════════════════════════════════════════════════════════════
-- Nestlink MVP — Initial Schema Migration
-- ══════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'resident', 'guard', 'staff');
CREATE TYPE resident_type AS ENUM ('owner', 'tenant');
CREATE TYPE visitor_pass_status AS ENUM ('active', 'used', 'expired', 'cancelled');
CREATE TYPE visitor_log_action AS ENUM ('checkin', 'checkout');
CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE amenity_booking_status AS ENUM ('confirmed', 'cancelled', 'completed');
CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');
CREATE TYPE staff_category AS ENUM ('maid', 'cook', 'driver', 'gardener', 'watchman', 'other');
CREATE TYPE notice_type AS ENUM ('info', 'urgent', 'event');
CREATE TYPE push_platform AS ENUM ('expo', 'web');
CREATE TYPE vehicle_type AS ENUM ('car', 'bike', 'cycle', 'other');

-- ─── Societies ────────────────────────────────────────────────────

CREATE TABLE societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Towers ───────────────────────────────────────────────────────

CREATE TABLE towers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floors INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Flats ────────────────────────────────────────────────────────

CREATE TABLE flats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id UUID NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,
  number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '2BHK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tower_id, number)
);

-- ─── User Profiles ────────────────────────────────────────────────

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  role user_role NOT NULL DEFAULT 'resident',
  avatar_url TEXT,
  society_id UUID REFERENCES societies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Residents ────────────────────────────────────────────────────

CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type resident_type NOT NULL DEFAULT 'owner',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(flat_id, user_id)
);

-- ─── Family Members ───────────────────────────────────────────────

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Vehicles ─────────────────────────────────────────────────────

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  type vehicle_type NOT NULL DEFAULT 'car',
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Visitors ─────────────────────────────────────────────────────

CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  photo_url TEXT,
  purpose TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Visitor Passes ───────────────────────────────────────────────

CREATE TABLE visitor_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  flat_id UUID NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  qr_token TEXT NOT NULL UNIQUE,
  otp TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  status visitor_pass_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visitor_passes_otp ON visitor_passes(otp);
CREATE INDEX idx_visitor_passes_qr_token ON visitor_passes(qr_token);
CREATE INDEX idx_visitor_passes_flat_id ON visitor_passes(flat_id);

-- ─── Visitor Logs ─────────────────────────────────────────────────

CREATE TABLE visitor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id UUID NOT NULL REFERENCES visitor_passes(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES user_profiles(id),
  action visitor_log_action NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_visitor_logs_timestamp ON visitor_logs(timestamp);
CREATE INDEX idx_visitor_logs_guard_id ON visitor_logs(guard_id);

-- ─── Domestic Staff ───────────────────────────────────────────────

CREATE TABLE domestic_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  category staff_category NOT NULL DEFAULT 'maid',
  photo_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Staff Attendance ─────────────────────────────────────────────

CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES domestic_staff(id) ON DELETE CASCADE,
  flat_id UUID NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  checkin_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkout_at TIMESTAMPTZ
);

-- ─── Notices ──────────────────────────────────────────────────────

CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type notice_type NOT NULL DEFAULT 'info',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notices_society_id ON notices(society_id);

-- ─── Complaints ───────────────────────────────────────────────────

CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status complaint_status NOT NULL DEFAULT 'open',
  priority complaint_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complaints_flat_id ON complaints(flat_id);
CREATE INDEX idx_complaints_status ON complaints(status);

-- ─── Amenities ────────────────────────────────────────────────────

CREATE TABLE amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20,
  open_time TEXT NOT NULL DEFAULT '06:00',
  close_time TEXT NOT NULL DEFAULT '22:00',
  slots_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Amenity Bookings ─────────────────────────────────────────────

CREATE TABLE amenity_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot TEXT NOT NULL,
  status amenity_booking_status NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(amenity_id, date, slot, resident_id)
);

CREATE INDEX idx_amenity_bookings_date ON amenity_bookings(amenity_id, date);

-- ─── Invoices ─────────────────────────────────────────────────────

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  late_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'pending',
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(flat_id, period)
);

CREATE INDEX idx_invoices_flat_id ON invoices(flat_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ─── Payments ─────────────────────────────────────────────────────

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);

-- ─── Push Tokens ──────────────────────────────────────────────────

CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform push_platform NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- ─── Updated At Triggers ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER societies_updated_at BEFORE UPDATE ON societies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER notices_updated_at BEFORE UPDATE ON notices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER complaints_updated_at BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER push_tokens_updated_at BEFORE UPDATE ON push_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-mark Overdue Invoices ───────────────────────────────────

CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS VOID AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue',
      late_fee = GREATEST(late_fee, amount * 0.02)
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
