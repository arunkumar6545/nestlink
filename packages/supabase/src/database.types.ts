export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | "super_admin"
  | "admin"
  | "hoa_president"
  | "hoa_secretary"
  | "hoa_treasurer"
  | "hoa_member"
  | "resident"
  | "guard"
  | "staff";
export type ResidentType = "owner" | "tenant";
export type VisitorPassStatus = "active" | "used" | "expired" | "cancelled";
export type VisitorLogAction = "checkin" | "checkout";
export type ComplaintStatus = "open" | "in_progress" | "resolved" | "closed";
export type ComplaintPriority = "low" | "medium" | "high" | "critical";
export type AmenityBookingStatus = "confirmed" | "cancelled" | "completed";
export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";
export type PaymentStatus = "pending" | "success" | "failed" | "refunded";
export type StaffCategory =
  | "maid"
  | "cook"
  | "driver"
  | "gardener"
  | "watchman"
  | "other";
export type NoticeType = "info" | "urgent" | "event";
export type PushPlatform = "expo" | "web";
export type VehicleType = "car" | "bike" | "cycle" | "other";

export interface Database {
  public: {
    Tables: {
      societies: {
        Row: {
          id: string;
          name: string;
          address: string;
          settings_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["societies"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["societies"]["Insert"]>;
      };
      towers: {
        Row: {
          id: string;
          society_id: string;
          name: string;
          floors: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["towers"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["towers"]["Insert"]>;
      };
      flats: {
        Row: {
          id: string;
          tower_id: string;
          floor: number;
          number: string;
          type: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["flats"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["flats"]["Insert"]>;
      };
      user_profiles: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string | null;
          role: UserRole;
          avatar_url: string | null;
          society_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };
      residents: {
        Row: {
          id: string;
          flat_id: string;
          user_id: string;
          type: ResidentType;
          approved_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["residents"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["residents"]["Insert"]>;
      };
      family_members: {
        Row: {
          id: string;
          resident_id: string;
          name: string;
          relation: string;
          photo_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["family_members"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["family_members"]["Insert"]>;
      };
      vehicles: {
        Row: {
          id: string;
          resident_id: string;
          plate: string;
          type: VehicleType;
          color: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["vehicles"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
      };
      visitors: {
        Row: {
          id: string;
          society_id: string;
          name: string;
          phone: string;
          photo_url: string | null;
          purpose: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["visitors"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["visitors"]["Insert"]>;
      };
      visitor_passes: {
        Row: {
          id: string;
          visitor_id: string;
          flat_id: string;
          qr_token: string;
          otp: string;
          valid_from: string;
          valid_until: string;
          status: VisitorPassStatus;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["visitor_passes"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["visitor_passes"]["Insert"]>;
      };
      visitor_logs: {
        Row: {
          id: string;
          pass_id: string;
          guard_id: string;
          action: VisitorLogAction;
          timestamp: string;
          notes: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["visitor_logs"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["visitor_logs"]["Insert"]>;
      };
      domestic_staff: {
        Row: {
          id: string;
          society_id: string;
          name: string;
          phone: string;
          category: StaffCategory;
          photo_url: string | null;
          verified: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["domestic_staff"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["domestic_staff"]["Insert"]>;
      };
      staff_attendance: {
        Row: {
          id: string;
          staff_id: string;
          flat_id: string;
          checkin_at: string;
          checkout_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["staff_attendance"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["staff_attendance"]["Insert"]>;
      };
      notices: {
        Row: {
          id: string;
          society_id: string;
          title: string;
          body: string;
          type: NoticeType;
          pinned: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notices"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["notices"]["Insert"]>;
      };
      complaints: {
        Row: {
          id: string;
          flat_id: string;
          title: string;
          description: string;
          category: string;
          status: ComplaintStatus;
          priority: ComplaintPriority;
          assigned_to: string | null;
          photo_urls: string[];
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["complaints"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["complaints"]["Insert"]>;
      };
      amenities: {
        Row: {
          id: string;
          society_id: string;
          name: string;
          capacity: number;
          open_time: string;
          close_time: string;
          slots_json: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["amenities"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["amenities"]["Insert"]>;
      };
      amenity_bookings: {
        Row: {
          id: string;
          amenity_id: string;
          resident_id: string;
          date: string;
          slot: string;
          status: AmenityBookingStatus;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["amenity_bookings"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["amenity_bookings"]["Insert"]>;
      };
      invoices: {
        Row: {
          id: string;
          flat_id: string;
          period: string;
          amount: number;
          due_date: string;
          late_fee: number;
          status: InvoiceStatus;
          pdf_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["invoices"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          razorpay_order_id: string;
          razorpay_payment_id: string | null;
          amount: number;
          status: PaymentStatus;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: PushPlatform;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["push_tokens"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["push_tokens"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      resident_type: ResidentType;
      visitor_pass_status: VisitorPassStatus;
      visitor_log_action: VisitorLogAction;
      complaint_status: ComplaintStatus;
      complaint_priority: ComplaintPriority;
      amenity_booking_status: AmenityBookingStatus;
      invoice_status: InvoiceStatus;
      payment_status: PaymentStatus;
      staff_category: StaffCategory;
      notice_type: NoticeType;
      push_platform: PushPlatform;
      vehicle_type: VehicleType;
    };
  };
}
