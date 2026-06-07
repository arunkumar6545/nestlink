import { cn } from "@/lib/utils";

type Status = "open" | "in_progress" | "resolved" | "closed" | "pending" | "paid" | "overdue" | "cancelled" | "active" | "used" | "expired" | "confirmed" | "completed" | string;

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-red-100 text-red-700 border-red-200" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-700 border-green-200" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-600 border-gray-200" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700 border-green-200" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 border-gray-200" },
  active: { label: "Active", className: "bg-blue-100 text-blue-700 border-blue-200" },
  used: { label: "Used", className: "bg-gray-100 text-gray-600 border-gray-200" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-200" },
  confirmed: { label: "Confirmed", className: "bg-green-100 text-green-700 border-green-200" },
  completed: { label: "Completed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  low: { label: "Low", className: "bg-green-100 text-green-700 border-green-200" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-700 border-amber-200" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 border-orange-200" },
  critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200" },
  info: { label: "Info", className: "bg-blue-100 text-blue-700 border-blue-200" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 border-red-200" },
  event: { label: "Event", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
