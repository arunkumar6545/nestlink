// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Plus, Search, CheckCircle2, Clock, PauseCircle,
  AlertTriangle, ChevronRight, MoreVertical, Loader2, Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";

const STATUS = {
  active:    { label: "Active",    icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-500/20" },
  trial:     { label: "Trial",     icon: Clock,        color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-500/20" },
  suspended: { label: "Suspended", icon: PauseCircle,  color: "text-red-400",     bg: "bg-red-400/10 border-red-500/20" },
  churned:   { label: "Churned",   icon: AlertTriangle,color: "text-slate-500",   bg: "bg-slate-500/10 border-slate-500/20" },
};

const PLAN_STYLE = {
  enterprise: "text-violet-300 bg-violet-500/15 border-violet-700/30",
  pro:        "text-sky-300   bg-sky-500/15    border-sky-700/30",
  trial:      "text-amber-300 bg-amber-500/15  border-amber-700/30",
  free:       "text-slate-400 bg-slate-500/10  border-slate-700/20",
};

export default function SocietiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch]       = useState("");
  const [statusF, setStatusF]     = useState("all");
  const [planF, setPlanF]         = useState("all");
  const [menu, setMenu]           = useState<string | null>(null);

  const { data: societies, isLoading } = useQuery({
    queryKey: ["cp-societies", statusF, planF],
    queryFn: async () => {
      let q = supabase
        .from("societies")
        .select("id, name, address, city, state, plan, status, total_units, created_at, onboarded_at")
        .order("created_at", { ascending: false });
      if (statusF !== "all") q = q.eq("status", statusF);
      if (planF   !== "all") q = q.eq("plan", planF);
      const { data } = await q;
      return data ?? [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("set_society_status", { p_society_id: id, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cp-societies"] }); toast.success("Status updated"); setMenu(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const planMutation = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const { error } = await supabase.from("societies").update({ plan }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cp-societies"] }); toast.success("Plan updated"); setMenu(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = societies?.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.city ?? "").toLowerCase().includes(q);
  });

  const counts = societies ? {
    total: societies.length,
    active: societies.filter((s) => s.status === "active").length,
    trial: societies.filter((s) => s.status === "trial").length,
    suspended: societies.filter((s) => s.status === "suspended").length,
  } : null;

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">All Societies</h1>
          <p className="text-slate-400 text-sm mt-1">
            {counts ? `${counts.total} total · ${counts.active} active · ${counts.trial} trial · ${counts.suspended} suspended` : "Loading…"}
          </p>
        </div>
        <button
          onClick={() => navigate("/societies/new")}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-lg shadow-violet-600/20"
        >
          <Plus className="h-4 w-4" /> Onboard Society
        </button>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STATUS) as [string, typeof STATUS[keyof typeof STATUS]][]).map(([key, cfg]) => {
          const count = societies?.filter((s) => s.status === key).length ?? 0;
          return (
            <button
              key={key}
              onClick={() => setStatusF(statusF === key ? "all" : key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                statusF === key ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : `${cfg.bg} ${cfg.color} hover:opacity-80`
              }`}
            >
              <cfg.icon className={`h-3.5 w-3.5 ${statusF === key ? "text-violet-400" : cfg.color}`} />
              {cfg.label}
              <span className="font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + Plan filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
          <input
            placeholder="Search by name or city…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-violet-900/30 bg-[#1a1a2e] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={planF}
          onChange={(e) => setPlanF(e.target.value)}
          className="rounded-xl border border-violet-900/30 bg-[#1a1a2e] text-slate-300 text-sm px-3 py-2.5 focus:outline-none focus:border-violet-500/50"
        >
          <option value="all">All plans</option>
          <option value="trial">Trial</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3 border-b border-violet-900/15 text-[10px] font-bold uppercase tracking-widest text-slate-600">
          <span className="w-8" />
          <span>Society</span>
          <span className="w-24 text-center">Plan</span>
          <span className="w-28 text-center">Status</span>
          <span className="w-24 text-right hidden lg:block">Onboarded</span>
          <span className="w-16" />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        )}
        {!isLoading && filtered?.length === 0 && (
          <p className="text-slate-600 text-sm text-center py-16">No societies found</p>
        )}

        {filtered?.map((s) => {
          const cfg = STATUS[s.status] ?? STATUS.active;
          const StatusIcon = cfg.icon;
          return (
            <div
              key={s.id}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-violet-900/10 last:border-0 hover:bg-[#1a1a2e] transition-colors"
            >
              {/* Icon */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 shrink-0">
                <Building2 className="h-4 w-4 text-violet-400" />
              </div>

              {/* Name + location */}
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{s.name}</p>
                <p className="text-xs text-slate-600 truncate">{s.city}{s.state ? `, ${s.state}` : ""} · {s.total_units} units</p>
              </div>

              {/* Plan */}
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border w-24 text-center ${PLAN_STYLE[s.plan] ?? PLAN_STYLE.free}`}>
                {s.plan}
              </span>

              {/* Status pill */}
              <div className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border w-28 ${cfg.bg}`}>
                <StatusIcon className={`h-3 w-3 ${cfg.color}`} />
                <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>

              {/* Date */}
              <p className="text-xs text-slate-600 w-24 text-right hidden lg:block">
                {formatRelative(s.created_at)}
              </p>

              {/* Actions */}
              <div className="relative flex items-center gap-1 w-16 justify-end">
                <button
                  className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-violet-500/15 transition-colors"
                  onClick={() => setMenu(menu === s.id ? null : s.id)}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                <button
                  className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-violet-500/15 transition-colors"
                  onClick={() => navigate(`/societies/${s.id}`)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {menu === s.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                    <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-violet-900/40 bg-[#1a1a2e] shadow-2xl overflow-hidden">
                      <p className="px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">Change Status</p>
                      {(["active", "trial", "suspended"] as const).map((st) => {
                        const c = STATUS[st]; const Icon = c.icon;
                        return (
                          <button
                            key={st}
                            disabled={s.status === st}
                            onClick={() => statusMutation.mutate({ id: s.id, status: st })}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-violet-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
                          >
                            <Icon className={`h-3.5 w-3.5 ${c.color}`} /> Set {c.label}
                          </button>
                        );
                      })}
                      <div className="border-t border-violet-900/30 my-1" />
                      <p className="px-3 pt-1 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">Upgrade Plan</p>
                      {(["trial", "free", "pro", "enterprise"] as const).map((plan) => (
                        <button
                          key={plan}
                          disabled={s.plan === plan}
                          onClick={() => planMutation.mutate({ id: s.id, plan })}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-xs capitalize text-slate-300 hover:bg-violet-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
                        >
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase ${PLAN_STYLE[plan]}`}>{plan}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
