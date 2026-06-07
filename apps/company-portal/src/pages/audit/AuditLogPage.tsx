// @ts-nocheck
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  onboard_society:   "text-violet-300 bg-violet-500/10 border-violet-500/20",
  set_society_status:"text-amber-300 bg-amber-500/10 border-amber-500/20",
  promote_to_super_admin: "text-red-300 bg-red-500/10 border-red-500/20",
  assign_role:       "text-sky-300 bg-sky-500/10 border-sky-500/20",
};

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState("");
  const [actionF, setActionF] = useState("all");

  const { data: rawLog, isLoading } = useQuery({
    queryKey: ["audit-log", page, actionF],
    queryFn: async () => {
      let q = supabase
        .from("platform_audit_log")
        .select(`id, action, target_type, target_id, meta, created_at, actor:actor_id(name, phone)`)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (actionF !== "all") q = q.eq("action", actionF);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: actionTypes } = useQuery({
    queryKey: ["audit-action-types"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_audit_log").select("action");
      const unique = [...new Set((data ?? []).map((r) => r.action))];
      return unique;
    },
  });

  const filtered = rawLog?.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.action.includes(q) ||
      r.actor?.name?.toLowerCase().includes(q) ||
      JSON.stringify(r.meta).toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-slate-400 text-sm mt-1">Complete trail of platform-level actions performed by Nestlink staff</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
          <input
            placeholder="Search by action, actor, or metadata…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-violet-900/30 bg-[#1a1a2e] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={actionF}
          onChange={(e) => { setActionF(e.target.value); setPage(0); }}
          className="rounded-xl border border-violet-900/30 bg-[#1a1a2e] text-slate-300 text-sm px-3 py-2.5 focus:outline-none"
        >
          <option value="all">All actions</option>
          {(actionTypes ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Log */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
        <div className="px-5 py-3 border-b border-violet-900/15 grid grid-cols-[auto_1fr_auto_auto] gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-600">
          <span className="w-32">Action</span>
          <span>Details</span>
          <span className="w-36">Actor</span>
          <span className="w-24 text-right">Time</span>
        </div>

        {isLoading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-violet-900/10 last:border-0 px-5 animate-pulse bg-violet-900/5" />
        ))}

        {(filtered ?? []).map((log) => {
          const aColor = ACTION_COLORS[log.action] ?? "text-slate-400 bg-slate-500/10 border-slate-500/20";
          return (
            <div key={log.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-5 py-3.5 border-b border-violet-900/10 last:border-0 hover:bg-[#1a1a2e] transition-colors">
              <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border w-32 text-center ${aColor}`}>
                {log.action}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-300 truncate">
                  {log.target_type}
                  {log.meta?.society_name && <span className="text-white font-medium"> "{log.meta.society_name}"</span>}
                  {log.meta?.new_status && <span className="text-slate-400"> → {log.meta.new_status}</span>}
                  {log.meta?.admin_phone && <span className="text-slate-400"> admin: {log.meta.admin_phone}</span>}
                </p>
              </div>
              <span className="text-xs text-slate-500 w-36 truncate">
                {log.actor?.name ?? "Unknown"}
              </span>
              <span className="text-xs text-slate-600 w-24 text-right">
                {formatRelative(log.created_at)}
              </span>
            </div>
          );
        })}

        {!isLoading && filtered?.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <ScrollText className="h-8 w-8 text-slate-700" />
            <p className="text-slate-600 text-sm">No audit entries found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600">Page {page + 1}</p>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-900/30 text-xs text-slate-400 hover:text-white hover:border-violet-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            disabled={(rawLog?.length ?? 0) < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-900/30 text-xs text-slate-400 hover:text-white hover:border-violet-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
