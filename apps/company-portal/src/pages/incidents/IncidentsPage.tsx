// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Plus, ChevronDown, ChevronUp, Edit2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";

const SEVERITY_STYLE: Record<string, string> = {
  info:     "text-sky-400 bg-sky-500/10 border-sky-700/30",
  degraded: "text-amber-400 bg-amber-500/10 border-amber-700/30",
  outage:   "text-rose-400 bg-rose-500/10 border-rose-700/30",
};

const SEVERITY_ICON: Record<string, React.ElementType> = {
  info:     Info,
  degraded: AlertTriangle,
  outage:   AlertCircle,
};

const STATUS_ORDER = ["investigating", "identified", "monitoring", "resolved"];
const STATUS_STYLE: Record<string, string> = {
  investigating: "text-rose-400 bg-rose-500/10 border-rose-700/30",
  identified:    "text-amber-400 bg-amber-500/10 border-amber-700/30",
  monitoring:    "text-sky-400 bg-sky-500/10 border-sky-700/30",
  resolved:      "text-emerald-400 bg-emerald-500/10 border-emerald-700/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLE[status] ?? ""}`}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const Icon = SEVERITY_ICON[severity] ?? Info;
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${SEVERITY_STYLE[severity] ?? ""}`}>
      <Icon className="h-3.5 w-3.5" />
      {severity}
    </span>
  );
}

export default function IncidentsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity]       = useState("info");

  const { data: incidents } = useQuery({
    queryKey: ["incidents", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("platform_incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data } = await q;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("platform_incidents").insert({
        title, description, severity,
        status: "investigating",
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incident created");
      setTitle(""); setDescription(""); setSeverity("info");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const advance = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const nextIdx = STATUS_ORDER.indexOf(currentStatus) + 1;
      if (nextIdx >= STATUS_ORDER.length) return;
      const nextStatus = STATUS_ORDER[nextIdx];
      const { error } = await supabase
        .from("platform_incidents")
        .update({
          status: nextStatus,
          resolved_at: nextStatus === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status advanced");
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const active = (incidents ?? []).filter((i) => i.status !== "resolved").length;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Incidents</h1>
          <p className="text-slate-400 text-sm mt-1">
            {active > 0 ? `${active} active incident${active > 1 ? "s" : ""}` : "No active incidents"} — track and resolve platform issues
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Incident
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-violet-900/40 bg-[#181825] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Incident</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. API Gateway Latency Spike"
                className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-200 text-sm focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-300 text-sm focus:outline-none focus:border-violet-500/50"
              >
                <option value="info">Info</option>
                <option value="degraded">Degraded</option>
                <option value="outage">Outage</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is happening? What is the impact?"
              className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-200 text-sm focus:outline-none focus:border-violet-500/50 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
            <button
              onClick={() => create.mutate()}
              disabled={!title || create.isPending}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {create.isPending ? "Creating…" : "Create Incident"}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...STATUS_ORDER].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? "bg-violet-600/20 text-violet-300 border-violet-600/40"
                : "text-slate-400 border-slate-700/40 hover:border-slate-600"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {(incidents ?? []).length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-600">
            <CheckCircle2 className="h-8 w-8 mb-3" />
            <p>No incidents found</p>
          </div>
        ) : (
          (incidents ?? []).map((inc: any) => {
            const expanded = expandedId === inc.id;
            const isResolved = inc.status === "resolved";
            const nextStatusIdx = STATUS_ORDER.indexOf(inc.status) + 1;
            const canAdvance = nextStatusIdx < STATUS_ORDER.length;

            return (
              <div key={inc.id} className="rounded-xl border border-violet-900/20 bg-[#181825] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <SeverityBadge severity={inc.severity} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{inc.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatRelative(inc.created_at)}{inc.resolved_at ? ` · resolved ${formatRelative(inc.resolved_at)}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={inc.status} />
                    {canAdvance && !isResolved && (
                      <button
                        onClick={() => advance.mutate({ id: inc.id, currentStatus: inc.status })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 border border-emerald-700/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        → {STATUS_ORDER[nextStatusIdx]}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(expanded ? null : inc.id)}
                      className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {expanded && inc.description && (
                  <div className="border-t border-slate-800/60 px-5 py-4">
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{inc.description}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
