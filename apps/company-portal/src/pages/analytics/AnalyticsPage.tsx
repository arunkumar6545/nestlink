// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Users, Building2, MessageSquare, BarChart2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format, subMonths, startOfMonth } from "date-fns";

const COLORS = ["#8b5cf6", "#38bdf8", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

function kpiCard(label: string, value: string | number, Icon: any, color: string) {
  return (
    <div className={`rounded-xl border ${color} bg-[#181825] p-5`}>
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: societies } = useQuery({
    queryKey: ["analytics-societies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("id, name, plan, status, created_at");
      return data ?? [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["analytics-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, role, created_at, society_id");
      return data ?? [];
    },
  });

  const { data: complaints } = useQuery({
    queryKey: ["analytics-complaints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("id, status, created_at");
      return data ?? [];
    },
  });

  // Build 12-month buckets
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), 11 - i);
    return { key: format(startOfMonth(d), "yyyy-MM"), label: format(d, "MMM yy") };
  });

  function countByMonth(items: any[], field = "created_at") {
    return months.map(({ key, label }) => {
      const count = (items ?? []).filter((r) => r[field]?.startsWith(key)).length;
      return { label, count };
    });
  }

  const societyGrowth = countByMonth(societies ?? []);
  const userGrowth = countByMonth(users ?? []);
  const complaintGrowth = countByMonth(complaints ?? []);

  const combinedGrowth = months.map((m, i) => ({
    label: m.label,
    societies: societyGrowth[i].count,
    users: userGrowth[i].count,
  }));

  // Plan distribution
  const planCounts = (societies ?? []).reduce((acc, s) => {
    acc[s.plan] = (acc[s.plan] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const planPie = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

  // Role distribution
  const roleCounts = (users ?? []).reduce((acc, u) => {
    const r = u.role ?? "unknown";
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const rolePie = Object.entries(roleCounts)
    .filter(([r]) => !["super_admin"].includes(r))
    .map(([name, value]) => ({ name, value }));

  // Feature adoption: societies with groups, marketplace, documents
  const { data: groupSocs } = useQuery({
    queryKey: ["analytics-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("society_id");
      return [...new Set((data ?? []).map((r) => r.society_id))].length;
    },
  });

  const { data: mktSocs } = useQuery({
    queryKey: ["analytics-marketplace"],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_listings").select("society_id");
      return [...new Set((data ?? []).map((r) => r.society_id))].length;
    },
  });

  const { data: docSocs } = useQuery({
    queryKey: ["analytics-documents"],
    queryFn: async () => {
      const { data } = await supabase.from("society_documents").select("society_id");
      return [...new Set((data ?? []).map((r) => r.society_id))].length;
    },
  });

  const totalSocs = (societies ?? []).length || 1;
  const featureAdoption = [
    { feature: "Groups",      count: groupSocs ?? 0, pct: Math.round(((groupSocs ?? 0) / totalSocs) * 100) },
    { feature: "Marketplace", count: mktSocs ?? 0,   pct: Math.round(((mktSocs ?? 0) / totalSocs) * 100) },
    { feature: "Doc Vault",   count: docSocs ?? 0,   pct: Math.round(((docSocs ?? 0) / totalSocs) * 100) },
  ];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">12-month growth, engagement &amp; feature adoption</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCard("Total Societies",  (societies ?? []).length, Building2, "border-violet-900/40 text-violet-400")}
        {kpiCard("Total Users",      (users ?? []).length,     Users,     "border-sky-900/40 text-sky-400")}
        {kpiCard("Total Complaints", (complaints ?? []).length, MessageSquare, "border-amber-900/40 text-amber-400")}
        {kpiCard("Resolved",
          (complaints ?? []).filter(c => c.status === "resolved").length,
          BarChart2, "border-emerald-900/40 text-emerald-400"
        )}
      </div>

      {/* Growth chart */}
      <div className="rounded-xl border border-violet-900/20 bg-[#181825] p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-5">Growth — Societies &amp; Users (12 months)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={combinedGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid #374151", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="societies" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Societies" />
            <Line type="monotone" dataKey="users"     stroke="#38bdf8" strokeWidth={2} dot={false} name="Users" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Complaints engagement */}
      <div className="rounded-xl border border-violet-900/20 bg-[#181825] p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-5">Complaints Engagement (12 months)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={complaintGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid #374151", borderRadius: 8 }} />
            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Complaints" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Plan & Role distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-violet-900/20 bg-[#181825] p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Plan Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={planPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {planPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend formatter={(v) => <span className="text-slate-400 text-xs">{v}</span>} />
              <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid #374151", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-violet-900/20 bg-[#181825] p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">User Role Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={rolePie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {rolePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend formatter={(v) => <span className="text-slate-400 text-xs">{v}</span>} />
              <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid #374151", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Adoption */}
      <div className="rounded-xl border border-violet-900/20 bg-[#181825] p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-5">Feature Adoption</h2>
        <div className="space-y-4">
          {featureAdoption.map((f) => (
            <div key={f.feature}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{f.feature}</span>
                <span className="text-slate-300 font-medium">{f.count} societies ({f.pct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all"
                  style={{ width: `${f.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
