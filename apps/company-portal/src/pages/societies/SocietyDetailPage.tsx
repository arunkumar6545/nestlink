// @ts-nocheck
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Users, ArrowLeft, MapPin, Home, Shield,
  CheckCircle2, Clock, PauseCircle, AlertTriangle,
  MoreVertical, Trash2, ExternalLink, Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";
import BulkUnitUpload from "@/components/shared/BulkUnitUpload";

const STATUS_CFG = {
  active:    { label: "Active",    icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-500/20" },
  trial:     { label: "Trial",     icon: Clock,        color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-500/20" },
  suspended: { label: "Suspended", icon: PauseCircle,  color: "text-red-400",     bg: "bg-red-400/10 border-red-500/20" },
  churned:   { label: "Churned",   icon: AlertTriangle,color: "text-slate-500",   bg: "bg-slate-500/10 border-slate-500/20" },
};
const PLAN_COLORS = { enterprise: "#a78bfa", pro: "#38bdf8", trial: "#f59e0b", free: "#64748b" };

export default function SocietyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: society } = useQuery({
    queryKey: ["society-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("*")
        .eq("id", id)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["society-members", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, flat_number, created_at")
        .eq("society_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: complaints } = useQuery({
    queryKey: ["society-complaints", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("id, title, status, created_at")
        .eq("society_id", id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.rpc("set_society_status", { p_society_id: id, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["society-detail"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const planMutation = useMutation({
    mutationFn: async (plan: string) => {
      const { error } = await supabase.from("societies").update({ plan }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["society-detail"] }); toast.success("Plan upgraded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [showBulkUpload, setShowBulkUpload] = useState(false);

  if (!society) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  const cfg = STATUS_CFG[society.status] ?? STATUS_CFG.active;
  const StatusIcon = cfg.icon;
  const membersByRole = (role: string) => members?.filter((m) => m.role === role) ?? [];

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate("/societies")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="h-4 w-4" /> All Societies
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/20 shrink-0">
          <Building2 className="h-7 w-7 text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{society.name}</h1>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${cfg.bg}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            </div>
            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded border" style={{ color: PLAN_COLORS[society.plan], borderColor: `${PLAN_COLORS[society.plan]}40`, background: `${PLAN_COLORS[society.plan]}15` }}>
              {society.plan}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-sm text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {society.address}, {society.city}, {society.state} {society.pincode}
          </div>
        </div>

        {/* Bulk Upload */}
        <button
          onClick={() => setShowBulkUpload(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600/20 border border-sky-700/30 text-sky-300 text-xs font-semibold hover:bg-sky-600/30 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" /> Upload Units CSV
        </button>

        {/* Quick change status */}
        <div className="flex gap-2 flex-wrap">
          {(["active", "trial", "suspended"] as const).filter((s) => s !== society.status).map((s) => {
            const c = STATUS_CFG[s]; const Icon = c.icon;
            return (
              <button key={s} onClick={() => statusMutation.mutate(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${c.bg} ${c.color} hover:opacity-80`}>
                <Icon className="h-3 w-3" /> Set {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Units",  value: society.total_units ?? 0,                      icon: Home,   color: "text-violet-400 bg-violet-500/10" },
          { label: "Members",      value: members?.length ?? 0,                           icon: Users,  color: "text-sky-400 bg-sky-500/10" },
          { label: "Admins",       value: membersByRole("admin").length + membersByRole("hoa_president").length, icon: Shield, color: "text-amber-400 bg-amber-500/10" },
          { label: "Open Complaints", value: complaints?.filter((c) => c.status === "open").length ?? 0, icon: AlertTriangle, color: "text-red-400 bg-red-500/10" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color} mb-3`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Plan upgrade */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Upgrade / Change Plan</h3>
        <div className="flex flex-wrap gap-2">
          {(["trial", "free", "pro", "enterprise"] as const).map((p) => (
            <button
              key={p}
              disabled={society.plan === p}
              onClick={() => planMutation.mutate(p)}
              className={`text-xs font-bold uppercase px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90`}
              style={{ color: PLAN_COLORS[p], borderColor: `${PLAN_COLORS[p]}50`, background: society.plan === p ? `${PLAN_COLORS[p]}20` : `${PLAN_COLORS[p]}08` }}
            >
              {p}{society.plan === p ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Members list */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
        <div className="px-5 py-4 border-b border-violet-900/15">
          <h3 className="text-sm font-semibold text-white">Members ({members?.length ?? 0})</h3>
        </div>
        {(members ?? []).slice(0, 10).map((m) => {
          const roleColors = { admin: "text-sky-300", hoa_president: "text-violet-300", resident: "text-emerald-300", guard: "text-amber-300", staff: "text-slate-400" };
          return (
            <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-violet-900/10 last:border-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white shrink-0">
                {m.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{m.name}</p>
                <p className="text-xs text-slate-600">{m.phone}{m.flat_number ? ` · Flat ${m.flat_number}` : ""}</p>
              </div>
              <span className={`text-xs font-semibold capitalize ${roleColors[m.role] ?? "text-slate-500"}`}>{m.role.replace("_", " ")}</span>
              <span className="text-xs text-slate-700 hidden lg:block">{formatRelative(m.created_at)}</span>
            </div>
          );
        })}
        {(!members || members.length === 0) && (
          <p className="text-slate-600 text-sm text-center py-10">No members yet</p>
        )}
      </div>

      {/* Bulk Unit Upload modal */}
      {showBulkUpload && (
        <BulkUnitUpload
          societyId={id!}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["society-detail"] });
            setShowBulkUpload(false);
          }}
        />
      )}

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
        <h3 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white">Suspend this society</p>
            <p className="text-xs text-slate-500 mt-0.5">Members will be locked out until you reactivate</p>
          </div>
          <button
            onClick={() => statusMutation.mutate("suspended")}
            disabled={society.status === "suspended"}
            className="flex items-center gap-2 rounded-xl border border-red-700/40 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <PauseCircle className="h-3.5 w-3.5" /> Suspend
          </button>
        </div>
      </div>
    </div>
  );
}
