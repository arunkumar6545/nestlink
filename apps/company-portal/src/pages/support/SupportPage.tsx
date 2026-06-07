// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  HeadphonesIcon, AlertCircle, Clock, CheckCircle2, Filter,
  ChevronDown, ChevronRight, Loader2, MoreVertical,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";

const STATUS_CFG = {
  open:        { label: "Open",        color: "text-red-400",     bg: "bg-red-400/10 border-red-500/20",     icon: AlertCircle },
  in_progress: { label: "In Progress", color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-500/20", icon: Clock },
  resolved:    { label: "Resolved",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
};

const PRIORITY_CFG = {
  critical: "text-red-300 bg-red-500/10 border-red-500/20",
  high:     "text-orange-300 bg-orange-500/10 border-orange-500/20",
  medium:   "text-amber-300 bg-amber-500/10 border-amber-500/20",
  low:      "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [statusF, setStatusF]   = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", statusF],
    queryFn: async () => {
      let q = supabase
        .from("support_escalations")
        .select(`id, title, description, status, priority, created_at, updated_at,
          society:society_id(id, name),
          creator:created_by(name, phone),
          assignee:assigned_to(name)`)
        .order("created_at", { ascending: false });
      if (statusF !== "all") q = q.eq("status", statusF);
      const { data } = await q;
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("support_escalations").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["support-tickets"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = {
    open:        tickets?.filter((t) => t.status === "open").length ?? 0,
    in_progress: tickets?.filter((t) => t.status === "in_progress").length ?? 0,
    resolved:    tickets?.filter((t) => t.status === "resolved").length ?? 0,
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Support Queue</h1>
        <p className="text-slate-400 text-sm mt-1">Escalated issues from society admins requiring Nestlink attention</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {[["all", "All", null], ...Object.entries(STATUS_CFG).map(([k, v]) => [k, v.label, v])].map(([key, label, cfg]: any) => (
          <button
            key={key}
            onClick={() => setStatusF(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              statusF === key
                ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                : cfg
                ? `${cfg.bg} ${cfg.color}`
                : "border-violet-900/30 text-slate-500 hover:border-violet-700/40"
            }`}
          >
            {cfg && <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />}
            {label}
            {key !== "all" && <span className="font-bold">{counts[key] ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* Tickets */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      )}

      <div className="space-y-3">
        {(tickets ?? []).map((ticket) => {
          const scfg = STATUS_CFG[ticket.status] ?? STATUS_CFG.open;
          const SIcon = scfg.icon;
          const isOpen = expanded === ticket.id;

          return (
            <div key={ticket.id} className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
              <button
                className="flex w-full items-center gap-4 p-5 text-left hover:bg-[#1a1a2e] transition-colors"
                onClick={() => setExpanded(isOpen ? null : ticket.id)}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 ${scfg.bg}`}>
                  <SIcon className={`h-4 w-4 ${scfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm">{ticket.title}</p>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${PRIORITY_CFG[ticket.priority] ?? PRIORITY_CFG.low}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ticket.society?.name ?? "Unknown society"} · {ticket.creator?.name ?? "Unknown"} · {formatRelative(ticket.created_at)}
                  </p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0 ${scfg.bg} ${scfg.color}`}>
                  {scfg.label}
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-violet-900/15 px-5 pb-5 pt-4 space-y-4">
                  {ticket.description && (
                    <p className="text-sm text-slate-300 leading-relaxed">{ticket.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-slate-600">Change status:</span>
                    {(["open", "in_progress", "resolved"] as const).map((st) => {
                      const c = STATUS_CFG[st]; const Icon = c.icon;
                      return (
                        <button
                          key={st}
                          disabled={ticket.status === st}
                          onClick={() => updateMutation.mutate({ id: ticket.id, status: st })}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-all ${c.bg} ${c.color} disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80`}
                        >
                          <Icon className="h-3 w-3" /> {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && tickets?.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-3">
            <HeadphonesIcon className="h-10 w-10 text-slate-700" />
            <p className="text-slate-500 text-sm">No support tickets</p>
            <p className="text-slate-700 text-xs">Society admins can escalate issues to Nestlink from their portal</p>
          </div>
        )}
      </div>
    </div>
  );
}
