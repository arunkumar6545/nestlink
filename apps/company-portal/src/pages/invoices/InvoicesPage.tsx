// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Download, CheckCircle2, AlertTriangle, Send, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

const PLAN_AMOUNT: Record<string, number> = {
  enterprise: 25000,
  pro:        4999,
  trial:      0,
  free:       0,
};

const STATUS_STYLE: Record<string, string> = {
  draft:   "text-slate-400 bg-slate-500/10 border-slate-700/20",
  sent:    "text-sky-400 bg-sky-500/10 border-sky-700/30",
  paid:    "text-emerald-400 bg-emerald-500/10 border-emerald-700/30",
  overdue: "text-rose-400 bg-rose-500/10 border-rose-700/30",
};

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function InvoicesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [generatingMonth, setGeneratingMonth] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("subscription_invoices")
        .select("*, societies(name, city, plan)")
        .order("period", { ascending: false })
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data } = await q;
      return data ?? [];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subscription_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice marked as paid"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const sendReminder = useMutation({
    mutationFn: async (inv: any) => {
      const { error } = await supabase.from("platform_announcements").insert({
        title: `Invoice Due: ${inv.period}`,
        body:  `Your Nestlink subscription invoice for ${inv.period} (${formatINR(inv.amount)}) is pending. Please clear dues to continue using the platform.`,
        type: "warning",
        created_by: profile?.id,
        society_id: inv.society_id,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Reminder sent"),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  async function generateMonthlyInvoices() {
    setGeneratingMonth(true);
    try {
      const { data: socs } = await supabase
        .from("societies")
        .select("id, plan, status")
        .in("status", ["active"])
        .in("plan", ["pro", "enterprise"]);

      const period = format(new Date(), "yyyy-MM");
      const rows = (socs ?? []).map((s) => ({
        society_id: s.id,
        period,
        plan: s.plan,
        amount: PLAN_AMOUNT[s.plan] ?? 0,
        status: "draft",
        due_date: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10), "yyyy-MM-dd"),
      }));

      if (rows.length === 0) {
        toast.info("No active paid societies found");
        return;
      }

      const { error } = await supabase
        .from("subscription_invoices")
        .upsert(rows, { onConflict: "society_id,period" });
      if (error) throw error;
      toast.success(`Generated ${rows.length} invoice(s) for ${period}`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setGeneratingMonth(false);
    }
  }

  function downloadCSV() {
    if (!invoices?.length) return;
    const header = ["Society", "Period", "Plan", "Amount", "Status", "Due Date", "Paid At"];
    const rows = (invoices ?? []).map((inv: any) => [
      inv.societies?.name ?? "",
      inv.period,
      inv.plan,
      inv.amount,
      inv.status,
      inv.due_date ?? "",
      inv.paid_at ? format(new Date(inv.paid_at), "yyyy-MM-dd") : "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `nestlink-invoices-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  }

  const totalMRR = (invoices ?? [])
    .filter((i: any) => i.status === "paid" && i.period === format(new Date(), "yyyy-MM"))
    .reduce((s: number, i: any) => s + Number(i.amount), 0);

  const outstanding = (invoices ?? [])
    .filter((i: any) => ["draft", "sent", "overdue"].includes(i.status))
    .reduce((s: number, i: any) => s + Number(i.amount), 0);

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription Invoices</h1>
          <p className="text-slate-400 text-sm mt-1">Company-side billing records for all paid societies</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" /> CSV Export
          </button>
          <button
            onClick={generateMonthlyInvoices}
            disabled={generatingMonth}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {generatingMonth ? "Generating…" : "Generate Monthly"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: (invoices ?? []).length, color: "border-violet-900/40" },
          { label: "MRR Collected", value: formatINR(totalMRR), color: "border-emerald-900/40" },
          { label: "Outstanding",   value: formatINR(outstanding), color: "border-rose-900/40" },
          { label: "Paid This Month", value: (invoices ?? []).filter((i: any) => i.status === "paid" && i.period === format(new Date(), "yyyy-MM")).length, color: "border-sky-900/40" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border ${kpi.color} bg-[#181825] p-5`}>
            <p className="text-xs text-slate-400 mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "draft", "sent", "paid", "overdue"].map((s) => (
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

      {/* Table */}
      <div className="rounded-xl border border-violet-900/20 bg-[#181825] overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-600 text-sm">Loading…</div>
        ) : (invoices ?? []).length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-600">
            <Receipt className="h-8 w-8 mb-3" />
            <p>No invoices found. Generate monthly invoices to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-violet-900/20">
                {["Society", "Period", "Plan", "Amount", "Status", "Due Date", "Actions"].map((h) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).map((inv: any) => (
                <tr key={inv.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-slate-200 font-medium">{inv.societies?.name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{inv.societies?.city}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-400 font-mono text-xs">{inv.period}</td>
                  <td className="px-5 py-4 text-slate-400 capitalize">{inv.plan}</td>
                  <td className="px-5 py-4 text-slate-200 font-semibold">{formatINR(inv.amount)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[inv.status] ?? ""}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">{inv.due_date ?? "—"}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {inv.status !== "paid" && (
                        <>
                          <button
                            onClick={() => markPaid.mutate(inv.id)}
                            title="Mark as paid"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-emerald-500/10 border border-emerald-700/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                          </button>
                          <button
                            onClick={() => sendReminder.mutate(inv)}
                            title="Send reminder"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-sky-500/10 border border-sky-700/30 text-sky-400 hover:bg-sky-500/20 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" /> Remind
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
