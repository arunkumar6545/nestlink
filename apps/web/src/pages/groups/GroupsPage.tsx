// @ts-nocheck
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Users, Lock, Globe, ChevronRight,
  Search, Loader2, Hash, Send, UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useSocietyStore } from "@/store/society";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatRelative } from "@nestlink/core";

// ─── Constants ────────────────────────────────────────────────────

const PURPOSE_OPTIONS = [
  { value: "general",   label: "General",   emoji: "💬" },
  { value: "sports",    label: "Sports",    emoji: "🏏" },
  { value: "cultural",  label: "Cultural",  emoji: "🎭" },
  { value: "welfare",   label: "Welfare",   emoji: "🤝" },
  { value: "emergency", label: "Emergency", emoji: "🚨" },
  { value: "parents",   label: "Parents",   emoji: "👨‍👩‍👧" },
  { value: "other",     label: "Other",     emoji: "📌" },
];

const TYPE_OPTIONS = [
  { value: "open",            label: "Open", desc: "Anyone in the society can join", icon: Globe },
  { value: "request_to_join", label: "Request to Join", desc: "Members request, admin approves", icon: UserCheck },
  { value: "invite_only",     label: "Invite Only", desc: "Admin invites members", icon: Lock },
];

const purposeEmoji = (p: string) =>
  PURPOSE_OPTIONS.find((o) => o.value === p)?.emoji ?? "💬";

// ─── Schema ───────────────────────────────────────────────────────

const createGroupSchema = z.object({
  name: z.string().min(2, "Min 2 chars").max(80),
  description: z.string().max(500).optional(),
  purpose: z.enum(["general","sports","cultural","welfare","emergency","parents","other"]),
  type: z.enum(["open","request_to_join","invite_only"]),
});
type CreateGroupForm = z.infer<typeof createGroupSchema>;

// ─── Main Component ───────────────────────────────────────────────

export default function GroupsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/resident";
  const queryClient = useQueryClient();
  const activeSocietyId = useSocietyStore((s) => s.activeSocietyId);
  const societyId = activeSocietyId ?? profile?.society_id;

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const form = useForm<CreateGroupForm>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { purpose: "general", type: "invite_only" },
  });

  // ── My groups ─────────────────────────────────────────────────
  const { data: myGroups, isLoading: myLoading } = useQuery({
    queryKey: ["my-groups", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("group_members")
        .select(`
          role,
          groups:group_id (
            id, name, description, purpose, type,
            member_count, is_archived, created_at,
            last_message:group_messages(content, created_at)
          )
        `)
        .eq("user_id", profile.id)
        .order("joined_at", { ascending: false });
      return (data ?? []).map((d) => ({
        ...(d.groups as object),
        my_role: d.role,
      }));
    },
    enabled: !!profile?.id,
  });

  // ── Discover groups (open / request_to_join I haven't joined) ──
  const { data: discoverGroups } = useQuery({
    queryKey: ["discover-groups", societyId, profile?.id],
    queryFn: async () => {
      if (!societyId || !profile?.id) return [];
      // Get IDs I'm already in
      const { data: memberOf } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", profile.id);
      const memberIds = (memberOf ?? []).map((m) => m.group_id);

      const { data } = await supabase
        .from("groups")
        .select("id, name, description, purpose, type, member_count, created_at")
        .eq("society_id", societyId)
        .in("type", ["open", "request_to_join"])
        .eq("is_archived", false)
        .not("id", "in", memberIds.length ? `(${memberIds.map((id) => `'${id}'`).join(",")})` : "('00000000-0000-0000-0000-000000000000')")
        .order("member_count", { ascending: false });
      return data ?? [];
    },
    enabled: !!societyId && !!profile?.id,
  });

  // ── Create mutation ────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: CreateGroupForm) => {
      const { data: group, error } = await supabase
        .from("groups")
        .insert({
          society_id: societyId,
          name: data.name,
          description: data.description ?? null,
          purpose: data.purpose,
          type: data.type,
          created_by: profile!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      toast.success("Group created!");
      setCreateOpen(false);
      form.reset({ purpose: "general", type: "invite_only" });
      navigate(`${basePath}/groups/${group.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Join (open group) ─────────────────────────────────────────
  const joinMutation = useMutation({
    mutationFn: async ({ groupId, type }: { groupId: string; type: string }) => {
      if (type === "open") {
        const { error } = await supabase
          .from("group_members")
          .insert({ group_id: groupId, user_id: profile!.id, role: "member" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("group_join_requests")
          .insert({ group_id: groupId, user_id: profile!.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: ["my-groups"] });
      queryClient.invalidateQueries({ queryKey: ["discover-groups"] });
      toast.success(type === "open" ? "Joined group!" : "Request sent — waiting for admin approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredMy = myGroups?.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDiscover = discoverGroups?.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Groups"
        description="Connect with society members in purpose-driven groups"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                New Group
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create a new group</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
                className="space-y-4 mt-1"
              >
                <div className="space-y-2">
                  <Label>Group name *</Label>
                  <Input placeholder="e.g. Tower A Parents" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="What is this group about?"
                    className="resize-none"
                    rows={2}
                    {...form.register("description")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {PURPOSE_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => form.setValue("purpose", p.value as CreateGroupForm["purpose"])}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                          form.watch("purpose") === p.value
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className="text-xl">{p.emoji}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Who can join?</Label>
                  <div className="space-y-2">
                    {TYPE_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => form.setValue("type", value as CreateGroupForm["type"])}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all text-left ${
                          form.watch("type") === value
                            ? "border-primary bg-primary/5 font-medium"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Group"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">
              My Groups
              {myGroups && myGroups.length > 0 && (
                <span className="ml-2 rounded-full bg-primary text-white text-[10px] font-bold px-1.5 py-0.5">
                  {myGroups.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="discover">
              Discover
              {discoverGroups && discoverGroups.length > 0 && (
                <span className="ml-2 rounded-full bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5">
                  {discoverGroups.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── My Groups ──────────────────────────────────────── */}
          <TabsContent value="mine" className="mt-4">
            {myLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!myLoading && filteredMy?.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <div className="text-5xl">💬</div>
                <p className="text-muted-foreground font-medium">No groups yet</p>
                <p className="text-sm text-muted-foreground">Create a group or join one from the Discover tab</p>
              </div>
            )}
            <div className="space-y-3">
              {filteredMy?.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  myRole={g.my_role}
                  onClick={() => navigate(`${basePath}/groups/${g.id}`)}
                  showRole
                />
              ))}
            </div>
          </TabsContent>

          {/* ── Discover ───────────────────────────────────────── */}
          <TabsContent value="discover" className="mt-4">
            {filteredDiscover?.length === 0 && (
              <div className="text-center py-16 space-y-2">
                <div className="text-5xl">🔍</div>
                <p className="text-muted-foreground font-medium">No groups to discover</p>
                <p className="text-sm text-muted-foreground">All open groups in your society appear here</p>
              </div>
            )}
            <div className="space-y-3">
              {filteredDiscover?.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  action={
                    <Button
                      size="sm"
                      variant={g.type === "open" ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        joinMutation.mutate({ groupId: g.id, type: g.type });
                      }}
                      disabled={joinMutation.isPending}
                    >
                      {g.type === "open" ? "Join" : (
                        <><Send className="h-3.5 w-3.5 mr-1" />Request to Join</>
                      )}
                    </Button>
                  }
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── GroupCard sub-component ──────────────────────────────────────

function GroupCard({
  group, myRole, onClick, action, showRole,
}: {
  group: any;
  myRole?: string;
  onClick?: () => void;
  action?: React.ReactNode;
  showRole?: boolean;
}) {
  const TypeIcon = group.type === "open" ? Globe : group.type === "invite_only" ? Lock : UserCheck;

  return (
    <Card
      className={`transition-all border hover:border-primary/30 hover:shadow-md ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0 text-2xl">
          {purposeEmoji(group.purpose)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{group.name}</p>
            {showRole && myRole === "admin" && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                Admin
              </span>
            )}
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{group.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {group.member_count} member{group.member_count !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <TypeIcon className="h-3 w-3" />
              {group.type === "open" ? "Open" : group.type === "invite_only" ? "Invite only" : "Request to join"}
            </span>
            <span>{formatRelative(group.created_at)}</span>
          </div>
        </div>

        {/* Action */}
        <div className="shrink-0">
          {action ?? <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );
}
