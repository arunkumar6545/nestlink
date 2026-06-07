// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, Search, UserCog, Shield, Home,
  Phone, Building2, Loader2, Check, ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRelative } from "@nestlink/core";

type Role = "resident" | "admin" | "guard" | "staff" | "super_admin";

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: React.ElementType; desc: string }> = {
  super_admin: { label: "Super Admin",    color: "text-violet-300",  bg: "bg-violet-500/20", icon: Shield, desc: "Full platform control" },
  admin:       { label: "Society Admin",  color: "text-sky-300",     bg: "bg-sky-500/20",    icon: UserCog, desc: "Manages one society" },
  resident:    { label: "Resident",       color: "text-emerald-300", bg: "bg-emerald-500/20",icon: Home, desc: "Pay dues, raise complaints" },
  guard:       { label: "Guard",          color: "text-amber-300",   bg: "bg-amber-500/20",  icon: Shield, desc: "Verify visitor OTPs" },
  staff:       { label: "Staff",          color: "text-slate-400",   bg: "bg-slate-500/20",  icon: Users, desc: "View-only" },
};

export default function GlobalUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [editUser, setEditUser] = useState<{ id: string; name: string; role: Role } | null>(null);
  const [promotePhone, setPromotePhone] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["global-users", roleFilter, page],
    queryFn: async () => {
      let q = supabase
        .from("user_profiles")
        .select("id, name, phone, email, role, society_id, created_at, societies:society_id(name, city)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (roleFilter !== "all") q = q.eq("role", roleFilter);
      const { data, count } = await q;
      return { users: data ?? [], total: count ?? 0 };
    },
    staleTime: 15_000,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.phone?.includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  // Role change (super admin can set any role including super_admin)
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-users"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast.success("Role updated");
      setEditUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Promote to super admin by phone
  const promoteMutation = useMutation({
    mutationFn: async (phone: string) => {
      const fmt = phone.startsWith("+") ? phone : `+91${phone}`;
      const { error } = await supabase.rpc("promote_to_super_admin", { p_phone: fmt });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-users"] });
      toast.success("User promoted to Super Admin");
      setPromoteOpen(false);
      setPromotePhone("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">All Users</h1>
          <p className="text-slate-400 text-sm mt-1">{total} users across all societies</p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => setPromoteOpen(true)}
        >
          <Shield className="h-4 w-4" />
          Promote to Super Admin
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by name or phone…"
            className="pl-9 bg-slate-900 border-violet-900/30 text-white placeholder:text-slate-600 focus-visible:ring-violet-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 bg-slate-900 border-violet-900/30 text-slate-300">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, cfg]) => (
              <SelectItem key={role} value={role}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Role pills summary */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, cfg]) => {
          const count = data?.users?.filter((u) => u.role === role).length ?? 0;
          return count > 0 ? (
            <span key={role} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
              <cfg.icon className="h-3 w-3" />
              {cfg.label}: {count}
            </span>
          ) : null;
        })}
      </div>

      {/* Users list */}
      <div className="rounded-xl border border-violet-900/30 bg-slate-900 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-16">No users found</p>
        )}
        {filtered.map((u) => {
          const cfg = ROLE_CONFIG[u.role as Role] ?? ROLE_CONFIG.resident;
          const RoleIcon = cfg.icon;
          return (
            <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-violet-900/10 last:border-0 hover:bg-slate-800/40 transition-colors">
              {/* Avatar */}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 text-sm font-bold ${cfg.bg} ${cfg.color}`}>
                {u.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>

              {/* Name + phone */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm truncate">{u.name}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="h-3 w-3" />
                  {u.phone}
                </div>
              </div>

              {/* Society */}
              {u.societies && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 max-w-[140px] truncate">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{(u.societies as { name: string })?.name ?? "—"}</span>
                </div>
              )}

              {/* Role badge */}
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                <RoleIcon className="h-3 w-3" />
                {cfg.label}
              </span>

              {/* Joined */}
              <span className="text-xs text-slate-600 hidden lg:block shrink-0 w-20 text-right">
                {formatRelative(u.created_at)}
              </span>

              {/* Edit role */}
              <button
                onClick={() => setEditUser({ id: u.id, name: u.name, role: u.role as Role })}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-violet-500/20 transition-colors shrink-0"
              >
                <UserCog className="h-3.5 w-3.5" />
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="border-violet-900/30 text-slate-300 bg-slate-900">Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
              className="border-violet-900/30 text-slate-300 bg-slate-900">Next</Button>
          </div>
        </div>
      )}

      {/* Role edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-sm bg-slate-900 border-violet-900/40">
          <DialogHeader>
            <DialogTitle className="text-white">Change role for {editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 mt-2">
            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, cfg]) => (
              <button
                key={role}
                onClick={() => roleMutation.mutate({ userId: editUser!.id, role })}
                disabled={roleMutation.isPending || editUser?.role === role}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 border transition-all text-sm text-left ${
                  editUser?.role === role
                    ? `border-violet-500 ${cfg.bg}`
                    : "border-violet-900/30 hover:border-violet-700/50 hover:bg-violet-500/10"
                }`}
              >
                <cfg.icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="flex-1">
                  <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-xs text-slate-500">{cfg.desc}</p>
                </div>
                {editUser?.role === role && <Check className={`h-4 w-4 shrink-0 ${cfg.color}`} />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Promote to super admin dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-w-sm bg-slate-900 border-violet-900/40">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-400" />
              Promote to Super Admin
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400 mt-1">
            This grants full platform-level access. Use with caution.
          </p>
          <div className="space-y-3 mt-3">
            <Input
              placeholder="+91 9876543210"
              value={promotePhone}
              onChange={(e) => setPromotePhone(e.target.value)}
              className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-violet-900/30 text-slate-300" onClick={() => setPromoteOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700"
                disabled={promotePhone.length < 10 || promoteMutation.isPending}
                onClick={() => promoteMutation.mutate(promotePhone)}
              >
                {promoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Promote"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
