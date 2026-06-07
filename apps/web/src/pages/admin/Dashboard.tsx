// @ts-nocheck
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import {
  Users,
  AlertCircle,
  CreditCard,
  UserCheck,
  QrCode,
  Calendar,
  TrendingUp,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatRelative } from "@nestlink/core";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const societyId = profile?.society_id;

  const { data: stats } = useRealtimeQuery("residents", {
    queryKey: ["admin-stats", societyId],
    pollIntervalMs: 20_000,
    queryFn: async () => {
      if (!societyId) return null;
      const [residents, complaints, invoices, visitors] = await Promise.all([
        supabase
          .from("residents")
          .select("id, approved_at", { count: "exact" })
          .in("flat_id", await getFlatIds(societyId)),
        supabase
          .from("complaints")
          .select("id, status", { count: "exact" })
          .in("flat_id", await getFlatIds(societyId)),
        supabase
          .from("invoices")
          .select("id, amount, status")
          .in("flat_id", await getFlatIds(societyId))
          .eq("status", "paid"),
        supabase
          .from("visitor_logs")
          .select("id", { count: "exact" })
          .gte("timestamp", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      const totalResidents = residents.count ?? 0;
      const pendingApprovals = (residents.data ?? []).filter((r) => !r.approved_at).length;
      const openComplaints = (complaints.data ?? []).filter(
        (c) => c.status === "open" || c.status === "in_progress"
      ).length;
      const monthCollection = (invoices.data ?? []).reduce((sum, i) => sum + i.amount, 0);
      const visitorsToday = visitors.count ?? 0;

      return { totalResidents, pendingApprovals, openComplaints, monthCollection, visitorsToday };
    },
    enabled: !!societyId,
  });

  const { data: recentComplaints } = useRealtimeQuery("complaints", {
    queryKey: ["recent-complaints", societyId],
    pollIntervalMs: 15_000,
    queryFn: async () => {
      if (!societyId) return [];
      const flatIds = await getFlatIds(societyId);
      const { data } = await supabase
        .from("complaints")
        .select("id, title, status, priority, created_at, category")
        .in("flat_id", flatIds)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const { data: recentPayments } = useRealtimeQuery("invoices", {
    queryKey: ["recent-payments", societyId],
    pollIntervalMs: 30_000,
    queryFn: async () => {
      if (!societyId) return [];
      const flatIds = await getFlatIds(societyId);
      const { data } = await supabase
        .from("payments")
        .select("id, amount, status, paid_at, invoice_id")
        .in("invoice_id", await getInvoiceIds(flatIds))
        .order("paid_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const collectionChartData = [
    { month: "Jan", amount: 142000 },
    { month: "Feb", amount: 158000 },
    { month: "Mar", amount: 165000 },
    { month: "Apr", amount: 171000 },
    { month: "May", amount: 155000 },
    { month: "Jun", amount: stats?.monthCollection ?? 0 },
  ];

  const complaintChartData = [
    { category: "Plumbing", count: 8 },
    { category: "Electrical", count: 5 },
    { category: "Lift", count: 3 },
    { category: "Parking", count: 6 },
    { category: "Security", count: 2 },
    { category: "Other", count: 4 },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Admin Dashboard"
        description={`Welcome back, ${profile?.name ?? "Admin"}`}
      />

      <div className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Residents"
            value={stats?.totalResidents ?? "—"}
            icon={Users}
            description="Registered residents"
          />
          <StatCard
            title="Pending Approvals"
            value={stats?.pendingApprovals ?? "—"}
            icon={UserCheck}
            description="Awaiting admin review"
            iconClassName="bg-amber-100"
          />
          <StatCard
            title="Open Complaints"
            value={stats?.openComplaints ?? "—"}
            icon={AlertCircle}
            description="Active tickets"
            iconClassName="bg-red-100"
          />
          <StatCard
            title="This Month Collection"
            value={formatCurrency(stats?.monthCollection ?? 0)}
            icon={CreditCard}
            description="Maintenance payments"
            iconClassName="bg-green-100"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <StatCard
            title="Visitors Today"
            value={stats?.visitorsToday ?? "—"}
            icon={QrCode}
            description="Check-ins today"
            iconClassName="bg-blue-100"
          />
          <StatCard
            title="Active Amenity Bookings"
            value="—"
            icon={Calendar}
            description="Today's bookings"
            iconClassName="bg-purple-100"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Monthly Collections (₹)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={collectionChartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(199,89%,48%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(199,89%,48%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Collection"]} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(199,89%,48%)"
                    strokeWidth={2}
                    fill="url(#colorAmount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Complaints by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={complaintChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="category" type="category" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(199,89%,48%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Recent Complaints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentComplaints?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No complaints yet</p>
              )}
              {recentComplaints?.map((c) => (
                <div key={c.id} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium line-clamp-1">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.category} • {formatRelative(c.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                Recent Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPayments?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
              )}
              {recentPayments?.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.paid_at ? formatDate(p.paid_at) : "—"}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function getFlatIds(societyId: string): Promise<string[]> {
  const { data } = await supabase
    .from("flats")
    .select("id, towers!inner(society_id)")
    .eq("towers.society_id", societyId);
  return (data ?? []).map((f) => f.id);
}

async function getInvoiceIds(flatIds: string[]): Promise<string[]> {
  const { data } = await supabase.from("invoices").select("id").in("flat_id", flatIds);
  return (data ?? []).map((i) => i.id);
}
