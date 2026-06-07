// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Circle, Bell, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function OnboardingTrackerPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterPct, setFilterPct] = useState("all");

  const { data: societies } = useQuery({
    queryKey: ["onboarding-societies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("id, name, city, plan, status, created_at");
      return data ?? [];
    },
  });

  const { data: checklists } = useQuery({
    queryKey: ["onboarding-checklists"],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_checklists")
        .select("*")
        .order("sort_order");
      return data ?? [];
    },
  });

  const sendReminder = useMutation({
    mutationFn: async (soc: any) => {
      const { error } = await supabase.from("platform_announcements").insert({
        title: `Action Required: Complete Your Nestlink Setup`,
        body: `Hi ${soc.name} team — you have pending onboarding steps. Log in to your Nestlink portal to complete setup and unlock all features.`,
        type: "info",
        created_by: profile?.id,
        society_id: soc.id,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Reminder sent"),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  function getChecks(societyId: string) {
    return (checklists ?? []).filter((c) => c.society_id === societyId);
  }

  function getPct(societyId: string) {
    const checks = getChecks(societyId);
    if (checks.length === 0) return 0;
    return Math.round((checks.filter((c) => c.completed_at).length / checks.length) * 100);
  }

  const withPct = (societies ?? []).map((s) => ({ ...s, pct: getPct(s.id) }));
  const filtered = withPct.filter((s) => {
    if (filterPct === "stuck")    return s.pct < 50;
    if (filterPct === "partial")  return s.pct >= 50 && s.pct < 100;
    if (filterPct === "complete") return s.pct === 100;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => a.pct - b.pct);

  const stuck    = withPct.filter((s) => s.pct < 50).length;
  const partial  = withPct.filter((s) => s.pct >= 50 && s.pct < 100).length;
  const complete = withPct.filter((s) => s.pct === 100).length;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Onboarding Tracker</h1>
        <p className="text-slate-400 text-sm mt-1">Per-society setup checklist progress</p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3">
        {[
          { label: `${stuck} Stuck`, value: "stuck",    color: "text-rose-400 bg-rose-500/10 border-rose-700/30" },
          { label: `${partial} Partial`, value: "partial",  color: "text-amber-400 bg-amber-500/10 border-amber-700/30" },
          { label: `${complete} Complete`, value: "complete", color: "text-emerald-400 bg-emerald-500/10 border-emerald-700/30" },
          { label: "All",     value: "all",     color: "text-slate-300 bg-slate-500/10 border-slate-700/30" },
        ].map((pill) => (
          <button
            key={pill.value}
            onClick={() => setFilterPct(pill.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${pill.color} ${filterPct === pill.value ? "ring-2 ring-violet-500/50" : "opacity-70 hover:opacity-100"}`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-600">
          <AlertCircle className="h-8 w-8 mb-3" />
          <p>No societies match filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((soc) => {
            const checks  = getChecks(soc.id);
            const done    = checks.filter((c) => c.completed_at).length;
            const expanded = expandedId === soc.id;
            const pctColor = soc.pct === 100 ? "bg-emerald-500" : soc.pct >= 50 ? "bg-amber-500" : "bg-rose-500";

            return (
              <div key={soc.id} className="rounded-xl border border-violet-900/20 bg-[#181825] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <Link to={`/societies/${soc.id}`} className="text-sm font-semibold text-slate-200 hover:underline">
                        {soc.name}
                      </Link>
                      <p className="text-xs text-slate-500">{soc.city} · {soc.plan}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${pctColor} transition-all`} style={{ width: `${soc.pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-300 w-12 text-right">{done}/{checks.length}</span>
                    {soc.pct < 100 && (
                      <button
                        onClick={() => sendReminder.mutate(soc)}
                        title="Send reminder"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-sky-500/10 border border-sky-700/30 text-sky-400 hover:bg-sky-500/20 transition-colors"
                      >
                        <Bell className="h-3.5 w-3.5" /> Remind
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(expanded ? null : soc.id)}
                      className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-slate-800/60 px-5 py-4">
                    <div className="space-y-2.5">
                      {checks.map((step) => (
                        <div key={step.id} className="flex items-start gap-3">
                          {step.completed_at
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                            : <Circle className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                          }
                          <div>
                            <p className={`text-sm ${step.completed_at ? "text-slate-300" : "text-slate-500"}`}>
                              {step.step.replace(/_/g, " ")}
                            </p>
                            {step.description && <p className="text-xs text-slate-600 mt-0.5">{step.description}</p>}
                            {step.completed_at && (
                              <p className="text-xs text-emerald-600 mt-0.5">Completed {formatRelative(step.completed_at)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
