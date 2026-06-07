// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Plus, Trash2, ShieldCheck, Loader2, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative, getInitials } from "@/lib/utils";

export default function TeamPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [addPhone, setAddPhone]   = useState("");
  const [addName,  setAddName]    = useState("");
  const [adding,   setAdding]     = useState(false);

  const { data: team } = useQuery({
    queryKey: ["nestlink-team"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, created_at, avatar_url")
        .eq("role", "super_admin")
        .order("created_at");
      return data ?? [];
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      const phone = addPhone.startsWith("+") ? addPhone : `+91${addPhone}`;
      // First find or create the user profile
      const { data: existing } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("phone", phone)
        .single();
      if (!existing) throw new Error("No user found with that phone. They must sign up first.");
      const { error } = await supabase.rpc("promote_to_super_admin", { p_phone: phone });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nestlink-team"] });
      toast.success("Team member added");
      setAddPhone(""); setAddName(""); setAdding(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const demoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role: "admin" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nestlink-team"] });
      toast.success("Member removed from team");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Nestlink Team</h1>
          <p className="text-slate-400 text-sm mt-1">Super admins with full platform access ({team?.length ?? 0} members)</p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-lg shadow-violet-600/20"
        >
          <Plus className="h-4 w-4" /> Add Team Member
        </button>
      </div>

      {adding && (
        <div className="rounded-2xl border border-violet-500/30 bg-[#13131f] p-5 space-y-4 animate-slide-up">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-400" /> Add Nestlink Team Member
          </h3>
          <p className="text-xs text-slate-400">
            The person must have already signed up via the society portal. Their role will be upgraded to super_admin.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="tel"
              placeholder="Phone: +919876543210"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              className="rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="text-sm text-slate-400 hover:text-white px-3 py-2">Cancel</button>
            <button
              onClick={() => promoteMutation.mutate()}
              disabled={promoteMutation.isPending || !addPhone.trim()}
              className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white"
            >
              {promoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add as Super Admin"}
            </button>
          </div>
        </div>
      )}

      {/* Team grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(team ?? []).map((member) => (
          <div key={member.id} className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shrink-0">
              {getInitials(member.name ?? "?")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{member.name ?? "Unknown"}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" /> {member.phone}
              </p>
              <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wide mt-1.5 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Super Admin
              </p>
            </div>
            {member.id !== profile?.id && (
              <button
                onClick={() => {
                  if (confirm(`Remove ${member.name ?? "this member"} from the Nestlink team?`)) {
                    demoteMutation.mutate(member.id);
                  }
                }}
                className="p-2 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Remove from team"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {member.id === profile?.id && (
              <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-semibold">You</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
