// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Building2, Users, TrendingUp, Activity, Plus, ArrowRight,
  CheckCircle2, Clock, PauseCircle, AlertTriangle, Zap, BarChart3,
  Megaphone, HeadphonesIcon, ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative, formatNumber } from "@/lib/utils";

const PLAN_COLORS = {
  trial:      "#f59e0b",
  free:       "#64748b",
  pro:        "#38bdf8",
  enterprise: "#a78bfa",
};

function KpiCard({ label, value, sub, icon: Icon, trend, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-2xl border bg-[#13131f] p-5 hover:bg-[#1a1a2e] transition-all group ${color}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</p>
      <p className="text-sm font-medium text-slate-300 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
      <ArrowUpRight className="absolute top-4 right-4 h-3.5 w-3.5 text-slate-700 group-hover:text-slate-500 transition-colors" />
    </button>
  );
}

// Generate mock last 6 months growth data from real stats
function buildGrowthData(stats) {
  if (!stats) return [];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const base = Math.max(0, stats.total_societies - stats.new_societies_30d * 6);
  return months.map((m, i) => ({
    month: m,
    societies: Math.round(base + (stats.new_societies_30d * 0.8 * i)),
    users: Math.round((stats.total_users / 6) * (i + 1) * 0.9),
  }));
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_stats");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  const { data: societies } = useQuery({
    queryKey: ["recent-societies-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("id, name, city, plan, status, total_units, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: recentUsers } = useQuery({
    queryKey: ["recent-users-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, created_at")
        .order("created_at", { ascending: false })
        .limit(7);
      return data ?? [];
    },
  });

  const { data: auditLog } = useQuery({
    queryKey: ["recent-audit-dash"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_audit_log")
        .select("id, action, target_type, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const planPieData = societies
    ? Object.entries(
        societies.reduce((acc, s) => ({ ...acc, [s.plan]: (acc[s.plan] ?? 0) + 1 }), {})
      ).map(([name, value]) => ({ name, value }))
    : [];

  const growthData = buildGrowthData(stats);

  const statusIcon = (s) => {
    const map = {
      active:    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
      trial:     <Clock className="h-3.5 w-3.5 text-amber-400" />,
      suspended: <PauseCircle className="h-3.5 w-3.5 text-red-400" />,
      churned:   <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />,
    };
    return map[s] ?? null;
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Welcome back, {profile?.name ?? "Super Admin"} — here's your platform at a glance
          </p>
        </div>
        <button
          onClick={() => navigate("/societies/new")}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-lg shadow-violet-600/20"
        >
          <Plus className="h-4 w-4" /> Onboard Society
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Societies"
          value={stats?.total_societies ?? 0}
          sub={`${stats?.new_societies_30d ?? 0} onboarded this month`}
          icon={Building2}
          color="border-violet-900/40 text-violet-400"
          trend={stats?.new_societies_30d ? `+${stats.new_societies_30d} ↑` : undefined}
          onClick={() => navigate("/societies")}
        />
        <KpiCard
          label="Active Societies"
          value={stats?.active_societies ?? 0}
          sub={`${stats?.trial_societies ?? 0} on trial • ${stats?.suspended_societies ?? 0} suspended`}
          icon={CheckCircle2}
          color="border-emerald-900/40 text-emerald-400"
          onClick={() => navigate("/societies?status=active")}
        />
        <KpiCard
          label="Total Users"
          value={stats?.total_users ?? 0}
          sub={`${stats?.new_users_30d ?? 0} joined this month`}
          icon={Users}
          color="border-sky-900/40 text-sky-400"
          trend={stats?.new_users_30d ? `+${stats.new_users_30d}` : undefined}
          onClick={() => navigate("/team")}
        />
        <KpiCard
          label="Residents"
          value={stats?.total_residents ?? 0}
          sub={`${stats?.total_admins ?? 0} admins · ${stats?.total_guards ?? 0} guards`}
          icon={TrendingUp}
          color="border-amber-900/40 text-amber-400"
          onClick={() => navigate("/billing")}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Onboard Society", icon: Zap, href: "/societies/new", from: "from-violet-700", to: "to-violet-800" },
          { label: "Send Announcement", icon: Megaphone, href: "/announcements", from: "from-sky-700", to: "to-sky-800" },
          { label: "Support Queue", icon: HeadphonesIcon, href: "/support", from: "from-emerald-700", to: "to-emerald-800" },
          { label: "Revenue & Billing", icon: BarChart3, href: "/billing", from: "from-amber-700", to: "to-amber-800" },
        ].map(({ label, icon: Icon, href, from, to }) => (
          <button
            key={href}
            onClick={() => navigate(href)}
            className={`flex items-center gap-2.5 rounded-xl bg-gradient-to-r ${from} ${to} px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity text-left`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart — 2/3 width */}
        <div className="lg:col-span-2 rounded-2xl border border-violet-900/20 bg-[#13131f] p-6">
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-400" />
            Platform Growth (Last 6 Months)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={growthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="societyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }}
                cursor={{ stroke: "rgba(139,92,246,0.2)" }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Area type="monotone" dataKey="societies" name="Societies" stroke="#7c3aed" fill="url(#societyGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="users" name="Users" stroke="#38bdf8" fill="url(#userGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Plan Distribution Pie — 1/3 width */}
        <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-6">
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-400" />
            Plan Distribution
          </h2>
          {planPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={planPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {planPieData.map((entry, i) => (
                      <Cell key={i} fill={PLAN_COLORS[entry.name] ?? "#64748b"} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {planPieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PLAN_COLORS[d.name] ?? "#64748b" }} />
                      <span className="text-slate-400 capitalize">{d.name}</span>
                    </div>
                    <span className="font-semibold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No societies yet</div>
          )}
        </div>
      </div>

      {/* Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Societies */}
        <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-violet-900/15">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-violet-400" /> Recent Societies
            </h3>
            <button onClick={() => navigate("/societies")} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {(societies ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/societies/${s.id}`)}
              className="flex w-full items-center gap-3 px-5 py-3.5 border-b border-violet-900/10 last:border-0 hover:bg-[#1a1a2e] transition-colors text-left"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 shrink-0">
                <Building2 className="h-4 w-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{s.name}</p>
                <p className="text-xs text-slate-600">{s.city} · {s.total_units} units</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border" style={{ color: PLAN_COLORS[s.plan], borderColor: `${PLAN_COLORS[s.plan]}40`, background: `${PLAN_COLORS[s.plan]}15` }}>
                  {s.plan}
                </span>
                {statusIcon(s.status)}
              </div>
            </button>
          ))}
          {(!societies || societies.length === 0) && (
            <p className="text-slate-600 text-sm text-center py-10">No societies onboarded yet</p>
          )}
        </div>

        {/* Right column: new users + recent actions */}
        <div className="space-y-4">
          {/* New Users */}
          <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-violet-900/15">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-sky-400" /> Recent Sign-ups
              </h3>
            </div>
            {(recentUsers ?? []).slice(0, 4).map((u) => {
              const roleColors = { super_admin: "text-violet-300", admin: "text-sky-300", resident: "text-emerald-300", guard: "text-amber-300" };
              return (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3 border-b border-violet-900/10 last:border-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white shrink-0">
                    {u.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{u.name}</p>
                    <p className="text-xs text-slate-600">{u.phone}</p>
                  </div>
                  <span className={`text-xs font-semibold capitalize ${roleColors[u.role] ?? "text-slate-500"}`}>{u.role}</span>
                  <span className="text-xs text-slate-700">{formatRelative(u.created_at)}</span>
                </div>
              );
            })}
          </div>

          {/* Recent Audit Actions */}
          {auditLog && auditLog.length > 0 && (
            <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-violet-900/15">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-violet-400" /> Recent Actions
                </h3>
                <button onClick={() => navigate("/audit")} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors">
                  Full log <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              {auditLog.slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3 border-b border-violet-900/10 last:border-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  <p className="flex-1 text-xs text-slate-400">
                    <span className="font-mono text-violet-400">{log.action}</span>
                    {log.meta?.society_name && <span className="text-white"> "{log.meta.society_name}"</span>}
                  </p>
                  <span className="text-[10px] text-slate-700 shrink-0">{formatRelative(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
