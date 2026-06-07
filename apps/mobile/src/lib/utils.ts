/**
 * Standalone utility bundle for the mobile app.
 * Inlined from @nestlink/core to avoid workspace dependency issues with EAS Build.
 */
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

export type AmenitySlot = {
  start: string;
  end: string;
  max_bookings: number;
  label?: string;
};

export type UserRole =
  | "resident"
  | "admin"
  | "guard"
  | "staff"
  | "super_admin"
  | "hoa_president"
  | "hoa_secretary"
  | "hoa_treasurer"
  | "hoa_member";
