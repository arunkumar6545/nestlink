// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Plus, Search, CheckCircle2, PauseCircle,
  Clock, AlertTriangle, ChevronRight, MoreVertical,
  ArrowUpRight, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatRelative } from "@nestlink/core";

type SocietyStatus = "active" | "trial" | "suspended" | "churned";

const STATUS_CONFIG: Record<SocietyStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  active:    { label: "Active",    icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  trial:     { label: "Trial",     icon: Clock,        color: "text-amber-400",   bg: "bg-amber-400/10" },
  suspended: { label: "Suspended", icon: PauseCircle,  color: "text-red-400",     bg: "bg-red-400/10" },
  churned:   { label: "Churned",   icon: AlertTriangle,color: "text-slate-500",   bg: "bg-slate-500/10" },
};

const PLAN_COLORS: Record<string, string> = {
  enterprise: "bg-violet-500/20 text-violet-300 border border-violet-700/40",
  pro:        "bg-sky-500/20 text-sky-300 border border-sky-700/40",
  trial:      "bg-amber-500/20 text-amber-300 border border-amber-700/40",
  free:       "bg-slate-500/20 text-slate-400 border border-slate-700/30",
};

export default function SocietiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { data: societies, isLoading } = useQuery({
    queryKey: ["all-societies", statusFilter, planFilter],
    queryFn: async () => {
      let q = supabase
        .from("societies")
        .select("id, name, address, city, state, plan, status, total_units, created_at, onboarded_at")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (planFilter !== "all") q = q.eq("plan", planFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("set_society_status", {
        p_society_id: id,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-societies"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast.success("Society status updated");
      setOpenMenu(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const planMutation = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const { error } = await supabase
        .from("societies")
        .update({ plan, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-societies"] });
      toast.success("Plan updated");
      setOpenMenu(null);
    },
  });

  const filtered = societies?.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.city ?? "").toLowerCase().includes(q) ||
      (s.state ?? "").toLowerCase().includes(q)
    );
  });

  const totals = societies
    ? {
        total: societies.length,
        active: societies.filter((s) => s.status === "active").length,
        trial: societies.filter((s) => s.status === "trial").length,
        suspended: societies.filter((s) => s.status === "suspended").length,
      }
    : null;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">All Societies</h1>
          <p className="text-slate-400 text-sm mt-1">
            {totals ? `${totals.total} societies · ${totals.active} active · ${totals.trial} trial` : "Loading…"}
          </p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => navigate("/superadmin/onboard")}
        >
          <Plus className="h-4 w-4" />
          Onboard Society
        </Button>
      </div>

      {/* Summary chips */}
      {totals && (
        <div className="flex flex-wrap gap-3">
          {(Object.entries(STATUS_CONFIG) as [SocietyStatus, typeof STATUS_CONFIG[SocietyStatus]][]).map(
            ([key, cfg]) => {
              const count = societies?.filter((s) => s.status === key).length ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${
                    statusFilter === key
                      ? "border-violet-500 bg-violet-500/20 text-violet-300"
                      : "border-violet-900/30 bg-slate-900 text-slate-400 hover:border-violet-700/40"
                  }`}
                >
                  <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  {cfg.label}
                  <span className="font-bold">{count}</span>
                </button>
              );
            }
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by name or city…"
            className="pl-9 bg-slate-900 border-violet-900/30 text-white placeholder:text-slate-600 focus-visible:ring-violet-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-32 bg-slate-900 border-violet-900/30 text-slate-300">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-violet-900/30 bg-slate-900 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        )}
        {!isLoading && filtered?.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-16">
            No societies found
          </p>
        )}
        {filtered?.map((s) => {
          const cfg = STATUS_CONFIG[s.status as SocietyStatus] ?? STATUS_CONFIG.active;
          const StatusIcon = cfg.icon;
          return (
            <div
              key={s.id}
              className="group flex items-center gap-4 px-5 py-4 border-b border-violet-900/10 last:border-0 hover:bg-slate-800/40 transition-colors"
            >
              {/* Icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 shrink-0">
                <Building2 className="h-5 w-5 text-violet-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white text-sm">{s.name}</p>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${PLAN_COLORS[s.plan] ?? PLAN_COLORS.free}`}>
                    {s.plan}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {s.city}{s.state ? `, ${s.state}` : ""} · {s.total_units} units
                </p>
              </div>

              {/* Status */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${cfg.bg}`}>
                <StatusIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>

              {/* Date */}
              <p className="text-xs text-slate-600 hidden lg:block w-24 text-right shrink-0">
                {formatRelative(s.created_at)}
              </p>

              {/* Actions */}
              <div className="relative flex items-center gap-1 shrink-0">
                <button
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-violet-500/20 transition-colors"
                  onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {openMenu === s.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 top-8 z-20 w-52 bg-slate-800 border border-violet-900/40 rounded-xl shadow-2xl overflow-hidden">
                      <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Change Status
                      </p>
                      {(["active", "trial", "suspended"] as SocietyStatus[]).map((st) => (
                        <button
                          key={st}
                          disabled={s.status === st}
                          onClick={() => statusMutation.mutate({ id: s.id, status: st })}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {React.createElement(STATUS_CONFIG[st].icon, { className: `h-3.5 w-3.5 ${STATUS_CONFIG[st].color}` })}
                          Set {STATUS_CONFIG[st].label}
                        </button>
                      ))}
                      <div className="border-t border-violet-900/30 my-1" />
                      <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Upgrade Plan
                      </p>
                      {["trial", "free", "pro", "enterprise"].map((plan) => (
                        <button
                          key={plan}
                          disabled={s.plan === plan}
                          onClick={() => planMutation.mutate({ id: s.id, plan })}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed capitalize transition-colors"
                        >
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${PLAN_COLORS[plan] ?? ""}`}>
                            {plan}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <button
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-violet-500/20 transition-colors"
                  onClick={() => navigate(`/superadmin/societies/${s.id}`)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
