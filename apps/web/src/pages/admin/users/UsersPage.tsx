// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, UserCog, Shield, Home, Users, Phone,
  ChevronDown, Check, Loader2, Search, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useSocietyStore } from "@/store/society";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelative } from "@nestlink/core";

// ─── Types ────────────────────────────────────────────────────────

type Role = "resident" | "admin" | "guard" | "staff" | "super_admin";

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  resident: "Resident",
  guard: "Guard",
  staff: "Staff",
};

const ROLE_ICONS: Record<Role, React.ElementType> = {
  super_admin: Shield,
  admin: UserCog,
  resident: Home,
  guard: Shield,
  staff: Users,
};

const inviteSchema = z.object({
  phone: z.string().min(10).max(15).regex(/^\+?[0-9]{10,15}$/, "Invalid phone"),
  name: z.string().min(2, "Name required"),
  role: z.enum(["resident", "admin", "guard", "staff"]),
  flat_id: z.string().optional(),
});
type InviteForm = z.infer<typeof inviteSchema>;

// ─── Main Component ───────────────────────────────────────────────

export default function UsersPage() {
  const { profile } = useAuth();
  const activeSocietyId = useSocietyStore((s) => s.activeSocietyId);
  const societyId = activeSocietyId ?? profile?.society_id;
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<{
    id: string; name: string; role: Role;
  } | null>(null);

  // ── Fetch members ──────────────────────────────────────────────
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["society-members", societyId, roleFilter],
    queryFn: async () => {
      if (!societyId) return [];
      let q = supabase
        .from("user_profiles")
        .select("id, name, phone, email, role, avatar_url, created_at")
        .eq("society_id", societyId)
        .order("created_at", { ascending: false });
      if (roleFilter !== "all") q = q.eq("role", roleFilter);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!societyId,
    staleTime: 10_000,
  });

  // ── Fetch pending invitations ──────────────────────────────────
  const { data: invitations, isLoading: invLoading } = useQuery({
    queryKey: ["invitations", societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data } = await supabase
        .from("invitations")
        .select("id, phone, name, role, flat_id, status, expires_at, created_at, user_id")
        .eq("society_id", societyId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!societyId,
  });

  // ── Fetch flats for flat selector ─────────────────────────────
  const { data: flats } = useQuery({
    queryKey: ["flats-list", societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data } = await supabase
        .from("flats")
        .select("id, number, floor, towers!inner(name, society_id)")
        .eq("towers.society_id", societyId)
        .order("number");
      return (data ?? []) as Array<{
        id: string; number: string; floor: number;
        towers: { name: string };
      }>;
    },
    enabled: !!societyId,
  });

  // ── Invite mutation ────────────────────────────────────────────
  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "resident" },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteForm) => {
      const phone = data.phone.startsWith("+") ? data.phone : `+91${data.phone}`;
      const { error } = await supabase.from("invitations").insert({
        society_id: societyId,
        invited_by: profile!.id,
        phone,
        name: data.name,
        role: data.role,
        flat_id: data.flat_id || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation created — user can now sign in with their phone");
      inviteForm.reset({ role: "resident" });
      setInviteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Role update mutation ───────────────────────────────────────
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await supabase.rpc("assign_role", {
        target_user_id: userId,
        new_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["society-members"] });
      toast.success("Role updated successfully");
      setEditingUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Revoke invitation ──────────────────────────────────────────
  const revokeMutation = useMutation({
    mutationFn: async (invId: string) => {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", invId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation revoked");
    },
  });

  // ── Filter ────────────────────────────────────────────────────
  const filtered = members?.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      (m.email ?? "").toLowerCase().includes(q)
    );
  });

  const stats = members
    ? {
        total: members.length,
        admins: members.filter((m) => m.role === "admin" || m.role === "super_admin").length,
        residents: members.filter((m) => m.role === "resident").length,
        guards: members.filter((m) => m.role === "guard").length,
      }
    : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="User Management"
        description="Invite users, assign roles and manage society members"
        action={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite a user</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground -mt-2">
                The user will be auto-assigned this role when they sign in with
                their phone for the first time.
              </p>
              <form
                onSubmit={inviteForm.handleSubmit((d) => inviteMutation.mutate(d))}
                className="space-y-4 mt-2"
              >
                <div className="space-y-2">
                  <Label>Full name *</Label>
                  <Input placeholder="Ravi Kumar" {...inviteForm.register("name")} />
                  {inviteForm.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {inviteForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Phone number *</Label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 rounded-lg border bg-muted text-sm text-muted-foreground">
                      +91
                    </span>
                    <Input
                      placeholder="9876543210"
                      {...inviteForm.register("phone")}
                      className="flex-1"
                    />
                  </div>
                  {inviteForm.formState.errors.phone && (
                    <p className="text-xs text-destructive">
                      {inviteForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select
                    value={inviteForm.watch("role")}
                    onValueChange={(v) => inviteForm.setValue("role", v as InviteForm["role"])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resident">Resident</SelectItem>
                      <SelectItem value="admin">Society Admin</SelectItem>
                      <SelectItem value="guard">Security Guard</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inviteForm.watch("role") === "resident" && (
                  <div className="space-y-2">
                    <Label>Assign flat (optional)</Label>
                    <Select
                      value={inviteForm.watch("flat_id") ?? ""}
                      onValueChange={(v) => inviteForm.setValue("flat_id", v || undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No flat assigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No flat</SelectItem>
                        {flats?.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.towers?.name} — {f.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send Invite"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Members", value: stats.total, icon: Users },
              { label: "Admins", value: stats.admins, icon: UserCog },
              { label: "Residents", value: stats.residents, icon: Home },
              { label: "Guards", value: stats.guards, icon: Shield },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="members">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="invitations">
                Pending Invitations
                {invitations && invitations.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary text-white text-[10px] font-bold px-1.5 py-0.5">
                    {invitations.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="resident">Resident</SelectItem>
                <SelectItem value="guard">Guard</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Members tab */}
          <TabsContent value="members">
            <Card>
              <CardContent className="p-0">
                {membersLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!membersLoading && filtered?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No members found
                  </p>
                )}
                {filtered?.map((m) => {
                  const RoleIcon = ROLE_ICONS[m.role as Role] ?? Users;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-4 px-6 py-4 border-b last:border-0"
                    >
                      {/* Avatar */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0 font-semibold text-primary text-sm">
                        {m.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{m.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3" />
                          {m.phone}
                          {m.email && <span>• {m.email}</span>}
                        </div>
                      </div>

                      <StatusBadge status={m.role} />

                      {/* Role edit button */}
                      {m.id !== profile?.id && (
                        <Dialog
                          open={editingUser?.id === m.id}
                          onOpenChange={(open) =>
                            setEditingUser(open ? { id: m.id, name: m.name, role: m.role } : null)
                          }
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground"
                            onClick={() => setEditingUser({ id: m.id, name: m.name, role: m.role })}
                          >
                            <UserCog className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1">Change role</span>
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>Change role for {m.name}</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground">
                              Current role: <strong>{ROLE_LABELS[m.role as Role]}</strong>
                            </p>
                            <div className="grid grid-cols-1 gap-2 mt-2">
                              {(
                                [
                                  "resident",
                                  "admin",
                                  "guard",
                                  "staff",
                                ] as const
                              ).map((role) => (
                                <button
                                  key={role}
                                  onClick={() =>
                                    roleMutation.mutate({ userId: m.id, role })
                                  }
                                  disabled={roleMutation.isPending}
                                  className={`flex items-center gap-3 rounded-lg px-4 py-3 border transition-colors text-sm text-left ${
                                    m.role === role
                                      ? "border-primary bg-primary/5 text-primary font-semibold"
                                      : "hover:bg-accent hover:border-accent"
                                  }`}
                                >
                                  {(() => {
                                    const Icon = ROLE_ICONS[role];
                                    return <Icon className="h-4 w-4 shrink-0" />;
                                  })()}
                                  <div className="flex-1">
                                    <p className="font-medium">{ROLE_LABELS[role]}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {role === "admin"
                                        ? "Full society management access"
                                        : role === "resident"
                                        ? "Pay dues, raise complaints, invite visitors"
                                        : role === "guard"
                                        ? "Scan QR codes, verify OTPs"
                                        : "View-only access"}
                                    </p>
                                  </div>
                                  {m.role === role && (
                                    <Check className="h-4 w-4 text-primary shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      <p className="text-xs text-muted-foreground hidden lg:block">
                        {formatRelative(m.created_at)}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations tab */}
          <TabsContent value="invitations">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground font-normal">
                  Users on this list will be auto-onboarded when they sign in with
                  the matching phone number.
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {invLoading && (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!invLoading && invitations?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No pending invitations
                  </p>
                )}
                {invitations?.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-4 px-6 py-4 border-b last:border-0"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
                      <Phone className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{inv.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{inv.phone}</p>
                    </div>
                    <StatusBadge status={inv.role} />
                    <StatusBadge status="pending" />
                    <p className="text-xs text-muted-foreground hidden lg:block">
                      Expires {formatRelative(inv.expires_at)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => revokeMutation.mutate(inv.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
