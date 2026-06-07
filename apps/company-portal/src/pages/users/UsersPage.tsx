// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Users, Building2, ShieldAlert, UserCog, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const ROLE_STYLE: Record<string, string> = {
  super_admin:   "text-violet-300 bg-violet-500/15 border-violet-700/30",
  admin:         "text-sky-300 bg-sky-500/15 border-sky-700/30",
  hoa_president: "text-indigo-300 bg-indigo-500/15 border-indigo-700/30",
  hoa_secretary: "text-cyan-300 bg-cyan-500/15 border-cyan-700/30",
  hoa_treasurer: "text-teal-300 bg-teal-500/15 border-teal-700/30",
  hoa_member:    "text-blue-300 bg-blue-500/15 border-blue-700/30",
  guard:         "text-amber-300 bg-amber-500/15 border-amber-700/30",
  staff:         "text-orange-300 bg-orange-500/15 border-orange-700/30",
  resident:      "text-slate-300 bg-slate-500/10 border-slate-700/20",
};

const ROLES = ["resident", "admin", "guard", "staff", "hoa_president", "hoa_secretary", "hoa_treasurer", "hoa_member"];

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const { data: rows, isLoading } = useQuery({
    queryKey: ["global-users", search, filterRole, page],
    queryFn: async () => {
      let q = supabase
        .from("user_profiles")
        .select("id, name, phone, email, role, society_id, created_at, last_seen_at, is_banned, societies(name, city)")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      if (filterRole !== "all") q = q.eq("role", filterRole);

      const { data } = await q;
      return data ?? [];
    },
  });

  const promoteAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("assign_role", {
        p_user_id: userId,
        p_role: "admin",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Promoted to admin"); qc.invalidateQueries({ queryKey: ["global-users"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const toggleBan = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_banned: banned })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.banned ? "User banned" : "User unbanned");
      qc.invalidateQueries({ queryKey: ["global-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Global User Search</h1>
        <p className="text-slate-400 text-sm mt-1">Search and manage users across all societies</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, phone or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-300 text-sm focus:outline-none focus:border-violet-500/50"
        >
          <option value="all">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-violet-900/20 bg-[#181825] overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-600 text-sm">Loading…</div>
        ) : (rows ?? []).length === 0 ? (
          <div className="py-20 text-center text-slate-600">
            <Users className="h-8 w-8 mx-auto mb-3" />
            <p>No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-violet-900/20">
                {["Name / Phone", "Society", "Role", "Joined", "Last Seen", "Actions"].map((h) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((u: any) => (
                <tr key={u.id} className={`border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors ${u.is_banned ? "opacity-50" : ""}`}>
                  <td className="px-5 py-4">
                    <p className="text-slate-200 font-medium">{u.name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{u.phone ?? u.email ?? "—"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-400">
                    {u.societies ? (
                      <Link to={`/societies/${u.society_id}`} className="hover:text-violet-300 flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {u.societies.name}
                      </Link>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_STYLE[u.role] ?? "text-slate-400 bg-slate-500/10 border-slate-700/20"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">{formatRelative(u.created_at)}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">{u.last_seen_at ? formatRelative(u.last_seen_at) : "—"}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === "resident" && (
                        <button
                          onClick={() => promoteAdmin.mutate(u.id)}
                          title="Promote to admin"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <UserCog className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleBan.mutate({ id: u.id, banned: !u.is_banned })}
                        title={u.is_banned ? "Unban user" : "Ban user"}
                        className={`p-1.5 rounded-lg transition-colors ${u.is_banned ? "text-emerald-400 hover:bg-emerald-500/10" : "text-rose-400 hover:bg-rose-500/10"}`}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </button>
                      {u.society_id && (
                        <Link to={`/societies/${u.society_id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Showing page {page + 1}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-30 transition-colors">
            Previous
          </button>
          <button onClick={() => setPage((p) => p + 1)} disabled={(rows ?? []).length < PAGE_SIZE}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-30 transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
