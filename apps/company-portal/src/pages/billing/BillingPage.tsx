// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CreditCard, TrendingUp, Building2, Users, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatRelative } from "@/lib/utils";

const PLAN_MRR = { enterprise: 25000, pro: 4999, free: 0, trial: 0 };
const PLAN_COLORS = { enterprise: "#a78bfa", pro: "#38bdf8", trial: "#f59e0b", free: "#64748b" };
const PLAN_STYLE = {
  enterprise: "text-violet-300 bg-violet-500/15 border-violet-700/30",
  pro:        "text-sky-300   bg-sky-500/15    border-sky-700/30",
  trial:      "text-amber-300 bg-amber-500/15  border-amber-700/30",
  free:       "text-slate-400 bg-slate-500/10  border-slate-700/20",
};

export default function BillingPage() {
  const { data: societies } = useQuery({
    queryKey: ["billing-societies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("id, name, city, plan, status, total_units, created_at")
        .order("plan")
        .order("name");
      return data ?? [];
    },
  });

  const mrr = (societies ?? []).reduce((sum, s) => sum + (s.status === "active" ? PLAN_MRR[s.plan] ?? 0 : 0), 0);
  const arr = mrr * 12;

  const planCounts = (societies ?? []).reduce((acc, s) => {
    acc[s.plan] = (acc[s.plan] ?? 0) + 1;
    return acc;
  }, {});

  const planPieData = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

  const barData = [
    { name: "Enterprise", count: planCounts.enterprise ?? 0, mrr: (planCounts.enterprise ?? 0) * PLAN_MRR.enterprise },
    { name: "Pro",        count: planCounts.pro        ?? 0, mrr: (planCounts.pro        ?? 0) * PLAN_MRR.pro },
    { name: "Trial",      count: planCounts.trial      ?? 0, mrr: 0 },
    { name: "Free",       count: planCounts.free       ?? 0, mrr: 0 },
  ];

  const activePaying = (societies ?? []).filter((s) => s.status === "active" && ["pro","enterprise"].includes(s.plan)).length;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Revenue & Billing</h1>
        <p className="text-slate-400 text-sm mt-1">Platform revenue overview and subscription management</p>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Monthly Recurring Revenue", value: formatCurrency(mrr), icon: CreditCard, color: "border-violet-900/40 text-violet-400", trend: mrr > 0 },
          { label: "Annual Run Rate",            value: formatCurrency(arr), icon: TrendingUp, color: "border-emerald-900/40 text-emerald-400" },
          { label: "Paying Customers",           value: activePaying,        icon: Building2,  color: "border-sky-900/40 text-sky-400" },
          { label: "Total Societies",            value: societies?.length ?? 0, icon: Users,  color: "border-amber-900/40 text-amber-400" },
        ].map(({ label, value, icon: Icon, color, trend }) => (
          <div key={label} className={`relative rounded-2xl border bg-[#13131f] p-5 ${color}`}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${color} mb-4`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-sm text-slate-400 mt-0.5">{label}</p>
            {trend && <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-emerald-400" />}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by plan bar chart */}
        <div className="lg:col-span-2 rounded-2xl border border-violet-900/20 bg-[#13131f] p-6">
          <h3 className="text-sm font-semibold text-white mb-5">Revenue by Plan (MRR)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }}
                formatter={(val) => [formatCurrency(val as number), "MRR"]}
              />
              <Bar dataKey="mrr" name="MRR" radius={[6, 6, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={PLAN_COLORS[entry.name.toLowerCase()] ?? "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Plan distribution */}
        <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Plan Distribution</h3>
          {planPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={planPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                    {planPieData.map((e, i) => <Cell key={i} fill={PLAN_COLORS[e.name] ?? "#64748b"} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {planPieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[d.name] ?? "#64748b" }} />
                      <span className="text-slate-400 capitalize">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{d.value}</span>
                      <span className="text-slate-600">{formatCurrency((d.value as number) * (PLAN_MRR[d.name] ?? 0))}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-600 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Per-society billing table */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
        <div className="px-5 py-4 border-b border-violet-900/15">
          <h3 className="text-sm font-semibold text-white">All Societies — Billing Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-violet-900/15 text-[10px] uppercase tracking-widest text-slate-600">
                <th className="px-5 py-3 text-left font-semibold">Society</th>
                <th className="px-4 py-3 text-center font-semibold">Plan</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Units</th>
                <th className="px-4 py-3 text-right font-semibold">MRR</th>
                <th className="px-4 py-3 text-right font-semibold">Onboarded</th>
              </tr>
            </thead>
            <tbody>
              {(societies ?? []).map((s) => (
                <tr key={s.id} className="border-b border-violet-900/10 last:border-0 hover:bg-[#1a1a2e] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-600">{s.city}</p>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${PLAN_STYLE[s.plan] ?? PLAN_STYLE.free}`}>{s.plan}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-xs ${s.status === "active" ? "text-emerald-400" : s.status === "trial" ? "text-amber-400" : "text-red-400"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-300">{s.total_units}</td>
                  <td className="px-4 py-3.5 text-right font-semibold" style={{ color: PLAN_COLORS[s.plan] ?? "#64748b" }}>
                    {s.status === "active" ? formatCurrency(PLAN_MRR[s.plan] ?? 0) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 text-xs">{formatRelative(s.created_at)}</td>
                </tr>
              ))}
              {(!societies || societies.length === 0) && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-600 text-sm">No societies</td></tr>
              )}
            </tbody>
            <tfoot className="border-t border-violet-900/20">
              <tr>
                <td colSpan={4} className="px-5 py-3.5 text-sm font-semibold text-slate-400">Total MRR</td>
                <td className="px-4 py-3.5 text-right font-bold text-violet-300">{formatCurrency(mrr)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
