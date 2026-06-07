// @ts-nocheck
import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, UserPlus, Trash2, ShieldCheck, ShieldOff,
  CheckCircle, XCircle, Clock, Users, Phone,
  Loader2, Settings, Lock, Globe, UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRelative } from "@nestlink/core";

export default function GroupManagePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/resident";
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteName, setInviteName] = useState("");

  // ── Group info ────────────────────────────────────────────────
  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id, name, description, purpose, type, member_count, created_by")
        .eq("id", groupId)
        .single();
      return data;
    },
    enabled: !!groupId,
  });

  // ── Members ───────────────────────────────────────────────────
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["group-members-list", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("role, joined_at, user:user_id(id, name, phone, role)")
        .eq("group_id", groupId)
        .order("role");
      return data ?? [];
    },
    enabled: !!groupId,
  });

  // ── Join requests ─────────────────────────────────────────────
  const { data: joinRequests } = useQuery({
    queryKey: ["join-requests", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_join_requests")
        .select("id, message, status, created_at, user:user_id(id, name, phone)")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at");
      return data ?? [];
    },
    enabled: !!groupId,
  });

  // ── Pending invitations ───────────────────────────────────────
  const { data: pendingInvites } = useQuery({
    queryKey: ["group-invitations", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_invitations")
        .select("id, invitee_phone, status, created_at, invitee:invitee_id(name)")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!groupId,
  });

  // ── Mutations ─────────────────────────────────────────────────

  const inviteMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name: string }) => {
      const fmt = phone.startsWith("+") ? phone : `+91${phone}`;
      // Find user by phone
      const { data: user } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("phone", fmt)
        .single();

      const { error } = await supabase.from("group_invitations").insert({
        group_id: groupId,
        invited_by: profile!.id,
        invitee_id: user?.id ?? null,
        invitee_phone: fmt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-invitations"] });
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInvitePhone("");
      setInviteName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, userId, approve }: { requestId: string; userId: string; approve: boolean }) => {
      const { error: reqErr } = await supabase
        .from("group_join_requests")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_by: profile!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (reqErr) throw reqErr;

      if (approve) {
        const { error: memErr } = await supabase
          .from("group_members")
          .insert({ group_id: groupId, user_id: userId, role: "member" });
        if (memErr) throw memErr;
      }
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ["join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["group-members-list"] });
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      toast.success(approve ? "Request approved — user added to group" : "Request rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      const { error } = await supabase
        .from("group_members")
        .update({ role: makeAdmin ? "admin" : "member" })
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members-list"] });
      toast.success("Role updated");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members-list"] });
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      toast.success("Member removed");
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("group_invitations")
        .update({ status: "revoked" })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-invitations"] });
      toast.success("Invitation revoked");
    },
  });

  const typeIcon = group?.type === "open"
    ? Globe : group?.type === "invite_only"
    ? Lock : UserCheck;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background/90 backdrop-blur-sm sticky top-0 z-10">
        <button
          onClick={() => navigate(`${basePath}/groups/${groupId}`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Settings className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{group?.name}</p>
          <p className="text-xs text-muted-foreground">Group Management</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </div>

      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Members", value: group?.member_count ?? 0, icon: Users },
            { label: "Pending Requests", value: joinRequests?.length ?? 0, icon: Clock },
            { label: "Pending Invites", value: pendingInvites?.length ?? 0, icon: UserPlus },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {joinRequests && joinRequests.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                  {joinRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invites">Invites</TabsTrigger>
          </TabsList>

          {/* ── Members ───────────────────────────────────────── */}
          <TabsContent value="members" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {membersLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {members?.map((m) => {
                  const u = m.user as { id: string; name: string; phone: string; role: string };
                  const isSelf = u?.id === profile?.id;
                  const isGroupAdmin = m.role === "admin";
                  return (
                    <div key={u?.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
                        {u?.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{u?.name}</p>
                          {isGroupAdmin && (
                            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                          {isSelf && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">You</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {u?.phone}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isGroupAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {isGroupAdmin ? "Admin" : "Member"}
                      </span>
                      {!isSelf && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAdminMutation.mutate({ userId: u.id, makeAdmin: !isGroupAdmin })}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={isGroupAdmin ? "Demote to member" : "Promote to admin"}
                          >
                            {isGroupAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => removeMemberMutation.mutate(u.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove from group"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Join Requests ──────────────────────────────────── */}
          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">
                  Approve or reject membership requests
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {joinRequests?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No pending requests
                  </p>
                )}
                {joinRequests?.map((req) => {
                  const u = req.user as { id: string; name: string; phone: string };
                  return (
                    <div key={req.id} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 shrink-0">
                        {u?.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{u?.name}</p>
                        <p className="text-xs text-muted-foreground">{u?.phone}</p>
                        {req.message && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">"{req.message}"</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground hidden lg:block shrink-0">
                        {formatRelative(req.created_at)}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => approveRequestMutation.mutate({ requestId: req.id, userId: u.id, approve: false })}
                          disabled={approveRequestMutation.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => approveRequestMutation.mutate({ requestId: req.id, userId: u.id, approve: true })}
                          disabled={approveRequestMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pending Invitations ────────────────────────────── */}
          <TabsContent value="invites" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {pendingInvites?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No pending invitations
                  </p>
                )}
                {pendingInvites?.map((inv) => {
                  const invitee = inv.invitee as { name: string } | null;
                  return (
                    <div key={inv.id} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 shrink-0">
                        <Phone className="h-4 w-4 text-sky-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{invitee?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{inv.invitee_phone}</p>
                      </div>
                      <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">Pending</span>
                      <span className="text-xs text-muted-foreground hidden lg:block">{formatRelative(inv.created_at)}</span>
                      <button
                        onClick={() => revokeInviteMutation.mutate(inv.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite to {group?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Enter the phone number of a society member to invite them.
          </p>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label>Name (optional)</Label>
              <Input
                placeholder="Their name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 rounded-lg border bg-muted text-sm text-muted-foreground">+91</span>
                <Input
                  placeholder="9876543210"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={invitePhone.length < 10 || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate({ phone: invitePhone, name: inviteName })}
              >
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
