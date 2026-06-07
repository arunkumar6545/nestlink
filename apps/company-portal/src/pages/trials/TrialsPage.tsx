// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, AlertTriangle, CheckCircle, XCircle, Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import { differenceInDays, addDays, parseISO } from "date-fns";
import { Link } from "react-router-dom";

const PLAN_PRICES = { free: 0, trial: 0, pro: 4999, enterprise: 25000 };

export default function TrialsPage() {
  const qc = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);

  const { data: trials } = useQuery({
    queryKey: ["trials"],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("id, name, city, plan, status, created_at, updated_at, total_units")
        .eq("plan", "trial")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: admins } = useQuery({
    queryKey: ["society-admins"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, society_id, role, last_seen_at")
        .eq("role", "admin");
      return data ?? [];
    },
  });

  const extend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("set_society_status", {
        p_society_id: id,
        p_status: "trial_extended",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trial extended by 30 days");
      qc.invalidateQueries({ queryKey: ["trials"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const convertPlan = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const { error } = await supabase
        .from("societies")
        .update({ plan, status: "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(`Converted to ${v.plan} plan`);
      qc.invalidateQueries({ queryKey: ["trials"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const markChurned = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("societies")
        .update({ status: "churned" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Society marked as churned");
      qc.invalidateQueries({ queryKey: ["trials"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  function getAdmin(societyId: string) {
    return (admins ?? []).find((a) => a.society_id === societyId);
  }

  function getDaysLeft(createdAt: string) {
    const trialEnd = addDays(parseISO(createdAt), 30);
    return differenceInDays(trialEnd, new Date());
  }

  const sorted = [...(trials ?? [])].sort((a, b) => getDaysLeft(a.created_at) - getDaysLeft(b.created_at));

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Trial Manager</h1>
        <p className="text-slate-400 text-sm mt-1">
          {sorted.length} trial societies — sorted by days remaining
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <CheckCircle className="h-8 w-8 mb-3" />
          <p>No active trials</p>
        </div>
      ) : (
        <div className="rounded-xl border border-violet-900/20 bg-[#181825] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-violet-900/20">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Society</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Days Left</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Seen</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((soc) => {
                const admin = getAdmin(soc.id);
                const daysLeft = getDaysLeft(soc.created_at);
                const urgency = daysLeft < 0 ? "expired" : daysLeft <= 5 ? "critical" : daysLeft <= 14 ? "warning" : "ok";
                const urgencyColor = {
                  expired: "text-rose-400 bg-rose-500/10 border-rose-700/30",
                  critical: "text-rose-400 bg-rose-500/10 border-rose-700/30",
                  warning: "text-amber-400 bg-amber-500/10 border-amber-700/30",
                  ok: "text-emerald-400 bg-emerald-500/10 border-emerald-700/30",
                }[urgency];
                const loading = actionId === soc.id;

                return (
                  <tr key={soc.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <Link to={`/societies/${soc.id}`} className="text-slate-200 hover:text-violet-300 font-medium">
                        {soc.name}
                      </Link>
                      <p className="text-xs text-slate-500">{soc.city}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {admin ? (
                        <div>
                          <p className="text-slate-300">{admin.name}</p>
                          <p className="text-xs text-slate-500">{admin.phone}</p>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">No admin</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${urgencyColor}`}>
                        <Clock className="h-3 w-3" />
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {admin?.last_seen_at ? formatRelative(admin.last_seen_at) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setActionId(soc.id); extend.mutate(soc.id); }}
                          disabled={loading}
                          title="Extend trial 30 days"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-amber-500/10 border border-amber-700/30 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Extend
                        </button>
                        <button
                          onClick={() => { setActionId(soc.id); convertPlan.mutate({ id: soc.id, plan: "pro" }); }}
                          disabled={loading}
                          title="Convert to Pro"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-violet-500/10 border border-violet-700/30 text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> → Pro
                        </button>
                        <button
                          onClick={() => { setActionId(soc.id); markChurned.mutate(soc.id); }}
                          disabled={loading}
                          title="Mark as churned"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-rose-500/10 border border-rose-700/30 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Churn
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
