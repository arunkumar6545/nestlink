export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  total_residents: number;
  pending_approvals: number;
  open_complaints: number;
  this_month_collection: number;
  total_visitors_today: number;
  active_amenity_bookings: number;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  icon?: string;
  badge?: number;
}

export interface VisitorPassWithDetails {
  id: string;
  qr_token: string;
  otp: string;
  valid_from: string;
  valid_until: string;
  status: string;
  visitor: {
    id: string;
    name: string;
    phone: string;
    purpose: string;
    photo_url: string | null;
  };
  flat: {
    id: string;
    number: string;
    floor: number;
    tower: {
      id: string;
      name: string;
    };
  };
}

export interface InvoiceWithDetails {
  id: string;
  period: string;
  amount: number;
  due_date: string;
  late_fee: number;
  status: string;
  pdf_url: string | null;
  flat: {
    id: string;
    number: string;
    floor: number;
    tower: { name: string };
  };
}

export interface ComplaintWithDetails {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
  due_date: string | null;
  flat: {
    number: string;
    tower: { name: string };
  };
  assigned_user: {
    name: string;
    phone: string;
  } | null;
}

export interface AmenityWithBookings {
  id: string;
  name: string;
  capacity: number;
  open_time: string;
  close_time: string;
  slots_json: AmenitySlot[];
  bookings_today: number;
}

export interface AmenitySlot {
  start: string;
  end: string;
  max_bookings: number;
  label?: string;
}
