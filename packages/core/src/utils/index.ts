import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from "date-fns";

export function formatDate(date: string | Date, pattern = "dd MMM yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy, hh:mm a");
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function isExpired(date: string | Date): boolean {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isBefore(d, new Date());
}

export function isActive(from: string | Date, until: string | Date): boolean {
  const now = new Date();
  const f = typeof from === "string" ? parseISO(from) : from;
  const u = typeof until === "string" ? parseISO(until) : until;
  return isAfter(now, f) && isBefore(now, u);
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateQrToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPeriod(period: string): string {
  // period: "2024-01" → "January 2024"
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, "MMMM yyyy");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .trim();
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const COMPLAINT_STATUS_COLORS: Record<string, string> = {
  open: "red",
  in_progress: "amber",
  resolved: "green",
  closed: "gray",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "green",
  medium: "amber",
  high: "orange",
  critical: "red",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  pending: "amber",
  paid: "green",
  overdue: "red",
  cancelled: "gray",
};
