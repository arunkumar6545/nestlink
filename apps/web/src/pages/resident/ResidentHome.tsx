// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { QrCode, AlertCircle, CreditCard, Calendar, Bell, UserCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatRelative, formatCurrency } from "@nestlink/core";

const quickLinks = [
  { label: "Invite Visitor", href: "/resident/visitors", icon: QrCode, color: "bg-blue-50 text-blue-600" },
  { label: "Raise Complaint", href: "/resident/complaints", icon: AlertCircle, color: "bg-red-50 text-red-600" },
  { label: "Pay Dues", href: "/resident/payments", icon: CreditCard, color: "bg-green-50 text-green-600" },
  { label: "Book Amenity", href: "/resident/amenities", icon: Calendar, color: "bg-purple-50 text-purple-600" },
  { label: "Notices", href: "/resident/notices", icon: Bell, color: "bg-amber-50 text-amber-600" },
  { label: "My Staff", href: "/resident/staff", icon: UserCheck, color: "bg-teal-50 text-teal-600" },
];

export default function ResidentHome() {
  const { profile } = useAuth();

  const { data: pendingInvoice } = useQuery({
    queryKey: ["resident-pending-invoice", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, amount, period, due_date")
        .eq("status", "pending")
        .order("due_date")
        .limit(1)
        .single();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: recentNotices } = useQuery({
    queryKey: ["resident-notices", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("id, title, type, created_at, pinned")
        .eq("society_id", profile!.society_id!)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const { data: activeVisitors } = useQuery({
    queryKey: ["resident-active-visitors", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitor_passes")
        .select(`
          id, status, valid_until,
          visitors:visitor_id (name, purpose)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="px-8 py-6 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <p className="text-sm text-muted-foreground">Good day,</p>
        <h1 className="text-2xl font-bold mt-0.5">{profile?.name ?? "Resident"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome to your society portal</p>
      </div>

      <div className="p-8 space-y-8">
        {/* Pending Invoice Alert */}
        {pendingInvoice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-800">Payment Due</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Maintenance for {pendingInvoice.period} — {formatCurrency(pendingInvoice.amount)}
                </p>
              </div>
              <Link
                to="/resident/payments"
                className="flex items-center gap-1 text-sm font-medium text-amber-800 hover:underline"
              >
                Pay Now <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="flex flex-col items-center gap-2 rounded-xl p-4 border hover:border-primary/40 hover:shadow-sm transition-all group"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${link.color} group-hover:scale-105 transition-transform`}>
                  <link.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-center leading-tight">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Visitor Passes */}
          <Card>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-semibold text-sm">Active Visitor Passes</h3>
              <Link to="/resident/visitors" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            <CardContent className="px-5 pb-5 space-y-2">
              {activeVisitors?.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No active passes</p>
              )}
              {activeVisitors?.map((vp) => {
                const visitor = vp.visitors as { name: string; purpose: string } | null;
                return (
                  <div key={vp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{visitor?.name}</p>
                      <p className="text-xs text-muted-foreground">{visitor?.purpose}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status="active" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Until {formatRelative(vp.valid_until)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Recent Notices */}
          <Card>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-semibold text-sm">Recent Notices</h3>
              <Link to="/resident/notices" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            <CardContent className="px-5 pb-5 space-y-2">
              {recentNotices?.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No notices</p>
              )}
              {recentNotices?.map((n) => (
                <div key={n.id} className="py-2 border-b last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium flex-1 truncate">{n.title}</p>
                    <StatusBadge status={n.type} />
                  </div>
                  <p className="text-xs text-muted-foreground">{formatRelative(n.created_at)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
