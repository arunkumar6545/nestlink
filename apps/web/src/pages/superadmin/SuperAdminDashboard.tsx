// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, ShieldCheck, TrendingUp,
  Zap, BarChart3, Clock, ArrowRight,
  CheckCircle2, AlertTriangle, PauseCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative, formatDate } from "@nestlink/core";

interface PlatformStats {
  total_societies: number;
  active_societies: number;
  trial_societies: number;
  suspended_societies: number;
  total_users: number;
  total_residents: number;
  total_admins: number;
  total_guards: number;
  new_societies_30d: number;
  new_users_30d: number;
}

function KpiCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; trend?: string;
}) {
  return (
    <div className="rounded-xl border border-violet-900/30 bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
      <p className="text-sm font-medium text-slate-300 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_stats");
      if (error) throw error;
      return data as PlatformStats;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: recentSocieties } = useQuery({
    queryKey: ["recent-societies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("id, name, city, plan, status, created_at, total_units")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: recentUsers } = useQuery({
    queryKey: ["recent-users-platform"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, society_id, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: auditLog } = useQuery({
    queryKey: ["recent-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_audit_log")
        .select("id, action, target_type, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const statusIcon = (status: string) => {
    if (status === "active") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    if (status === "trial") return <Clock className="h-3.5 w-3.5 text-amber-400" />;
    if (status === "suspended") return <PauseCircle className="h-3.5 w-3.5 text-red-400" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />;
  };

  const planColor: Record<string, string> = {
    enterprise: "bg-violet-500/20 text-violet-300 border-violet-700/40",
    pro: "bg-sky-500/20 text-sky-300 border-sky-700/40",
    trial: "bg-amber-500/20 text-amber-300 border-amber-700/40",
    free: "bg-slate-500/20 text-slate-400 border-slate-700/40",
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Welcome back, {profile?.name ?? "Super Admin"} — full platform overview
        </p>
      </div>

      {/* KPI grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-900 animate-pulse border border-violet-900/20" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Societies"
              value={stats?.total_societies ?? 0}
              sub={`${stats?.new_societies_30d ?? 0} new this month`}
              icon={Building2}
              color="bg-violet-500/20 text-violet-400"
              trend={stats?.new_societies_30d ? `+${stats.new_societies_30d}` : undefined}
            />
            <KpiCard
              label="Active Societies"
              value={stats?.active_societies ?? 0}
              sub={`${stats?.trial_societies ?? 0} on trial`}
              icon={CheckCircle2}
              color="bg-emerald-500/20 text-emerald-400"
            />
            <KpiCard
              label="Total Users"
              value={stats?.total_users ?? 0}
              sub={`${stats?.new_users_30d ?? 0} joined this month`}
              icon={Users}
              color="bg-sky-500/20 text-sky-400"
              trend={stats?.new_users_30d ? `+${stats.new_users_30d}` : undefined}
            />
            <KpiCard
              label="Residents"
              value={stats?.total_residents ?? 0}
              sub={`${stats?.total_admins ?? 0} admins · ${stats?.total_guards ?? 0} guards`}
              icon={TrendingUp}
              color="bg-amber-500/20 text-amber-400"
            />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Onboard New Society",
                desc: "Set up a new society and assign its admin",
                icon: Zap,
                href: "/superadmin/onboard",
                color: "from-violet-600 to-violet-700",
              },
              {
                label: "Manage All Societies",
                desc: "View, suspend, or upgrade any society",
                icon: Building2,
                href: "/superadmin/societies",
                color: "from-sky-600 to-sky-700",
              },
              {
                label: "Platform Analytics",
                desc: "Growth, retention and usage metrics",
                icon: BarChart3,
                href: "/superadmin/analytics",
                color: "from-emerald-600 to-emerald-700",
              },
            ].map(({ label, desc, icon: Icon, href, color }) => (
              <button
                key={href}
                onClick={() => navigate(href)}
                className={`text-left rounded-xl p-5 bg-gradient-to-br ${color} hover:opacity-90 transition-opacity group`}
              >
                <Icon className="h-7 w-7 text-white mb-3" />
                <p className="font-bold text-white text-sm">{label}</p>
                <p className="text-white/70 text-xs mt-1 leading-relaxed">{desc}</p>
                <div className="flex items-center gap-1 mt-3 text-white/60 text-xs">
                  Go <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Recent societies + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent societies */}
        <div className="rounded-xl border border-violet-900/30 bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-violet-900/20">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Building2 className="h-4 w-4 text-violet-400" />
              Recent Societies
            </h2>
            <button
              onClick={() => navigate("/superadmin/societies")}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div>
            {recentSocieties?.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">No societies yet</p>
            )}
            {recentSocieties?.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-5 py-3.5 border-b border-violet-900/10 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/superadmin/societies/${s.id}`)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 shrink-0">
                  <Building2 className="h-4 w-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.city} · {s.total_units} units</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${planColor[s.plan] ?? planColor.free}`}>
                    {s.plan}
                  </span>
                  {statusIcon(s.status)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent users */}
        <div className="rounded-xl border border-violet-900/30 bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-violet-900/20">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-400" />
              New Users
            </h2>
            <button
              onClick={() => navigate("/superadmin/users")}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div>
            {recentUsers?.map((u) => {
              const roleColor: Record<string, string> = {
                super_admin: "text-violet-300",
                admin: "text-sky-300",
                resident: "text-emerald-300",
                guard: "text-amber-300",
                staff: "text-slate-400",
              };
              return (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3 border-b border-violet-900/10 last:border-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 shrink-0 text-xs font-bold text-white">
                    {u.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.phone}</p>
                  </div>
                  <span className={`text-xs font-semibold capitalize ${roleColor[u.role] ?? "text-slate-400"}`}>
                    {u.role}
                  </span>
                  <span className="text-xs text-slate-600 hidden lg:block">
                    {formatRelative(u.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Audit log */}
      {auditLog && auditLog.length > 0 && (
        <div className="rounded-xl border border-violet-900/30 bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-violet-900/20">
            <ShieldCheck className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Recent Platform Actions</h2>
          </div>
          <div className="divide-y divide-violet-900/10">
            {auditLog.map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                <p className="flex-1 text-slate-300">
                  <span className="font-mono text-violet-400 text-xs">{log.action}</span>
                  {" on "}
                  <span className="text-slate-400">{log.target_type}</span>
                  {log.meta?.society_name && (
                    <span className="text-white"> "{log.meta.society_name}"</span>
                  )}
                </p>
                <span className="text-xs text-slate-600 shrink-0">{formatRelative(log.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
