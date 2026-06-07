// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Plus, Globe, Building2, Info, AlertTriangle, Wrench, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/utils";

const TYPES = [
  { value: "info",        label: "Info",        icon: Info,          color: "bg-sky-500/15 border-sky-500/30 text-sky-300" },
  { value: "warning",     label: "Warning",     icon: AlertTriangle, color: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
  { value: "maintenance", label: "Maintenance", icon: Wrench,        color: "bg-orange-500/15 border-orange-500/30 text-orange-300" },
];

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const [title,     setTitle]     = useState("");
  const [body,      setBody]      = useState("");
  const [type,      setType]      = useState("info");
  const [targetAll, setTargetAll] = useState(true);
  const [targetSoc, setTargetSoc] = useState("");

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_announcements")
        .select(`id, title, body, type, target_society_id, sent_at, created_at, sender:sent_by(name), society:target_society_id(name)`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: societies } = useQuery({
    queryKey: ["soc-list-ann"],
    queryFn: async () => {
      const { data } = await supabase.from("societies").select("id, name").order("name");
      return data ?? [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) throw new Error("Title and body are required");
      const { error } = await supabase.from("platform_announcements").insert({
        title: title.trim(),
        body: body.trim(),
        type,
        target_society_id: targetAll ? null : targetSoc || null,
        sent_by: profile!.id,
        sent_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement sent!");
      setCreating(false);
      setTitle(""); setBody(""); setType("info"); setTargetAll(true); setTargetSoc("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeInfo = (t: string) => TYPES.find((x) => x.value === t) ?? TYPES[0];

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Announcements</h1>
          <p className="text-slate-400 text-sm mt-1">Broadcast messages to all societies or specific ones</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-lg shadow-violet-600/20"
        >
          <Plus className="h-4 w-4" /> New Announcement
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-2xl border border-violet-500/30 bg-[#13131f] p-6 space-y-4 animate-slide-up">
          <h3 className="font-semibold text-white flex items-center gap-2"><Megaphone className="h-4 w-4 text-violet-400" /> Create Announcement</h3>

          {/* Type selector */}
          <div className="flex gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${type === t.value ? t.color : "border-violet-900/30 text-slate-500 hover:border-violet-700/40"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title…"
            className="w-full rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Announcement body — markdown supported…"
            rows={4}
            className="w-full rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
          />

          {/* Target */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <button
                type="button"
                onClick={() => setTargetAll(true)}
                className={`h-4 w-4 rounded-full border-2 transition-colors ${targetAll ? "border-violet-500 bg-violet-500" : "border-slate-600"}`}
              />
              <Globe className="h-3.5 w-3.5 text-slate-500" /> All Societies
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <button
                type="button"
                onClick={() => setTargetAll(false)}
                className={`h-4 w-4 rounded-full border-2 transition-colors ${!targetAll ? "border-violet-500 bg-violet-500" : "border-slate-600"}`}
              />
              <Building2 className="h-3.5 w-3.5 text-slate-500" /> Specific Society
            </label>
            {!targetAll && (
              <select
                value={targetSoc}
                onChange={(e) => setTargetSoc(e.target.value)}
                className="rounded-xl border border-violet-900/30 bg-[#1a1a2e] text-slate-300 text-sm px-3 py-1.5 focus:outline-none focus:border-violet-500/50"
              >
                <option value="">Select society…</option>
                {societies?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !title.trim() || !body.trim()}
              className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 text-sm font-semibold text-white transition-colors"
            >
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Send Announcement</>}
            </button>
          </div>
        </div>
      )}

      {/* Announcement history */}
      <div className="space-y-3">
        {(announcements ?? []).map((a) => {
          const t = typeInfo(a.type);
          const Icon = t.icon;
          return (
            <div key={a.id} className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-5">
              <div className="flex items-start gap-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 ${t.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-white">{a.title}</p>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${t.color}`}>{a.type}</span>
                    <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${a.target_society_id ? "text-sky-300 bg-sky-500/10 border-sky-500/20" : "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"}`}>
                      {a.target_society_id ? <><Building2 className="h-2.5 w-2.5" /> {a.society?.name ?? "Society"}</> : <><Globe className="h-2.5 w-2.5" /> All Societies</>}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{a.body}</p>
                  <p className="text-xs text-slate-600 mt-2">
                    Sent by {a.sender?.name ?? "Unknown"} · {formatRelative(a.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {(!announcements || announcements.length === 0) && !creating && (
          <div className="flex flex-col items-center py-20 gap-3">
            <Megaphone className="h-10 w-10 text-slate-700" />
            <p className="text-slate-500 text-sm">No announcements sent yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
