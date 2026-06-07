import { z } from "zod";

// ─── Auth ───────────────────────────────────────────────────────────────────

export const phoneSchema = z
  .string()
  .min(10)
  .max(15)
  .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number");

export const otpSchema = z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits");

export const loginSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
  type: z.enum(["sms", "phone_change"]).default("sms"),
});

// ─── Profile ─────────────────────────────────────────────────────────────────

export const userProfileSchema = z.object({
  name: z.string().min(2).max(100),
  phone: phoneSchema,
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["admin", "resident", "guard", "staff"]),
  avatar_url: z.string().url().optional().nullable(),
  society_id: z.string().uuid().optional().nullable(),
});

// ─── Resident Onboarding ─────────────────────────────────────────────────────

export const residentOnboardingSchema = z.object({
  flat_id: z.string().uuid(),
  type: z.enum(["owner", "tenant"]),
  name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
});

export const familyMemberSchema = z.object({
  resident_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  relation: z.string().min(1).max(50),
  photo_url: z.string().url().optional().nullable(),
});

export const vehicleSchema = z.object({
  resident_id: z.string().uuid(),
  plate: z.string().min(2).max(20).toUpperCase(),
  type: z.enum(["car", "bike", "cycle", "other"]),
  color: z.string().max(30).optional().nullable(),
});

// ─── Visitors ─────────────────────────────────────────────────────────────────

export const createVisitorSchema = z.object({
  name: z.string().min(2).max(100),
  phone: phoneSchema,
  purpose: z.string().min(2).max(200),
  photo_url: z.string().url().optional().nullable(),
  flat_id: z.string().uuid(),
  valid_from: z.string().datetime(),
  valid_until: z.string().datetime(),
});

export const verifyVisitorOtpSchema = z.object({
  otp: otpSchema,
  guard_id: z.string().uuid(),
  action: z.enum(["checkin", "checkout"]),
  notes: z.string().max(500).optional(),
});

export const scanQrSchema = z.object({
  qr_token: z.string().min(10),
  guard_id: z.string().uuid(),
  action: z.enum(["checkin", "checkout"]),
});

// ─── Notices ──────────────────────────────────────────────────────────────────

export const createNoticeSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(5).max(5000),
  type: z.enum(["info", "urgent", "event"]),
  pinned: z.boolean().default(false),
});

// ─── Complaints ───────────────────────────────────────────────────────────────

export const complaintCategories = [
  "Plumbing",
  "Electrical",
  "Lift",
  "Parking",
  "Security",
  "Cleaning",
  "Garden",
  "Internet",
  "Other",
] as const;

export const createComplaintSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  category: z.enum(complaintCategories),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  photo_urls: z.array(z.string().url()).max(5).default([]),
});

export const updateComplaintSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
});

// ─── Amenity Booking ──────────────────────────────────────────────────────────

export const createAmenitySchema = z.object({
  name: z.string().min(2).max(100),
  capacity: z.number().int().positive(),
  open_time: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  close_time: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  slots_json: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
      max_bookings: z.number().int().positive(),
    })
  ),
});

export const bookAmenitySchema = z.object({
  amenity_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  slot: z.string(),
});

// ─── Billing ──────────────────────────────────────────────────────────────────

export const generateInvoicesSchema = z.object({
  society_id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Format YYYY-MM"),
  amount: z.number().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
});

export const createRazorpayOrderSchema = z.object({
  invoice_id: z.string().uuid(),
});

// ─── Domestic Staff ───────────────────────────────────────────────────────────

export const createStaffSchema = z.object({
  name: z.string().min(2).max(100),
  phone: phoneSchema,
  category: z.enum(["maid", "cook", "driver", "gardener", "watchman", "other"]),
  photo_url: z.string().url().optional().nullable(),
  society_id: z.string().uuid(),
});

// ─── Push Notifications ───────────────────────────────────────────────────────

export const registerPushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["expo", "web"]),
});

export const sendPushNotificationSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.string(), z.unknown()).optional(),
});
