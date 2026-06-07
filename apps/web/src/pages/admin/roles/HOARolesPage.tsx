// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Crown, BookOpen, Wallet, Users, Shield, Home, QrCode, Wrench,
  CheckCircle, ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useSocietyStore } from "@/store/society";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@nestlink/core";

// ─── Role definitions ─────────────────────────────────────────────

const ROLE_DEFS = [
  {
    id: "admin",
    label: "Society Admin",
    icon: Shield,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    badge: "bg-purple-100 text-purple-700",
    description: "Full control over the entire society portal.",
    assignable: false, // set via super-admin only
    permissions: [
      "Full access to all features",
      "Manage all residents and roles",
      "Financial management",
      "Society settings and configuration",
      "Document vault (full)",
      "Onboard/remove members",
    ],
  },
  {
    id: "hoa_president",
    label: "HOA President",
    icon: Crown,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    description: "Elected head of the HOA committee. Near-admin access.",
    assignable: true,
    permissions: [
      "View admin dashboard & stats",
      "Manage residents list",
      "Create & manage notices",
      "Review & close complaints",
      "View & manage invoices",
      "Manage amenity bookings",
      "Manage guard roster",
      "Assign HOA roles to members",
      "Document vault — full access",
      "Groups, members, messages",
      "Marketplace",
    ],
  },
  {
    id: "hoa_secretary",
    label: "HOA Secretary",
    icon: BookOpen,
    color: "bg-sky-100 text-sky-700 border-sky-200",
    badge: "bg-sky-100 text-sky-700",
    description: "Maintains records, meeting minutes, notices, and documents.",
    assignable: true,
    permissions: [
      "View residents (read-only)",
      "Create & manage notices",
      "Manage complaints (assign / close)",
      "Document vault — upload & manage",
      "Groups, members, messages",
      "Marketplace",
    ],
  },
  {
    id: "hoa_treasurer",
    label: "HOA Treasurer",
    icon: Wallet,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    description: "Manages financial records, invoices, and dues.",
    assignable: true,
    permissions: [
      "View & manage invoices",
      "View payment records",
      "Generate financial reports",
      "Document vault — view only",
      "Members, messages",
      "Marketplace",
    ],
  },
  {
    id: "hoa_member",
    label: "HOA Member",
    icon: Users,
    color: "bg-teal-100 text-teal-700 border-teal-200",
    badge: "bg-teal-100 text-teal-700",
    description: "General elected committee member with limited admin access.",
    assignable: true,
    permissions: [
      "View admin dashboard",
      "View & create notices",
      "View complaints",
      "Document vault — view only",
      "Groups, members, messages",
      "Marketplace",
    ],
  },
  {
    id: "resident",
    label: "Resident",
    icon: Home,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    description: "Regular society member living in the society.",
    assignable: true,
    permissions: [
      "My Home dashboard",
      "Visitor passes & QR codes",
      "Submit & track complaints",
      "View notices & announcements",
      "Pay dues & view invoices",
      "Book amenities",
      "Staff directory",
      "Groups & group chat",
      "Members directory & DM",
      "Marketplace (buy & sell)",
    ],
  },
  {
    id: "guard",
    label: "Security Guard",
    icon: Shield,
    color: "bg-orange-100 text-orange-700 border-orange-200",
    badge: "bg-orange-100 text-orange-700",
    description: "Security personnel managing visitor entry.",
    assignable: true,
    permissions: [
      "QR scanner for visitor verification",
      "View visitor logs",
    ],
  },
  {
    id: "staff",
    label: "Staff",
    icon: Wrench,
    color: "bg-gray-100 text-gray-700 border-gray-200",
    badge: "bg-gray-100 text-gray-700",
    description: "Maintenance and operations staff.",
    assignable: true,
    permissions: [
      "View assigned tasks (coming soon)",
    ],
  },
];

const ASSIGNABLE_HOA = ["hoa_president", "hoa_secretary", "hoa_treasurer", "hoa_member", "resident", "guard", "staff"];

// ─── Main Component ───────────────────────────────────────────────

export default function HOARolesPage() {
  const { profile } = useAuth();
  const activeSocietyId = useSocietyStore((s) => s.activeSocietyId);
  const societyId = activeSocietyId ?? profile?.society_id;
  const queryClient = useQueryClient();
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // All members in this society
  const { data: members, isLoading } = useQuery({
    queryKey: ["all-members-roles", societyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, flat_number, avatar_url")
        .eq("society_id", societyId)
        .order("role")
        .order("name");
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-members-roles"] });
      toast.success("Role updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Group members by role
  const byRole = ASSIGNABLE_HOA.reduce<Record<string, typeof members>>((acc, r) => {
    acc[r] = members?.filter((m) => m.role === r) ?? [];
    return acc;
  }, {});

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Society Roles & Permissions"
        description="Assign elected HOA roles to society members and view role permissions"
      />

      <div className="p-8 space-y-8">
        <Tabs defaultValue="assign">
          <TabsList>
            <TabsTrigger value="assign">Assign Roles</TabsTrigger>
            <TabsTrigger value="reference">Role Reference Guide</TabsTrigger>
          </TabsList>

          {/* ── Assign Roles ───────────────────────────────────── */}
          <TabsContent value="assign" className="mt-6 space-y-4">
            <div className="grid gap-4">
              {members?.map((member) => {
                const roleDef = ROLE_DEFS.find((r) => r.id === member.role);
                const canChange = profile?.role === "admin" || profile?.role === "hoa_president";
                return (
                  <Card key={member.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0 ${roleDef?.badge ?? "bg-muted"}`}>
                        {getInitials(member.name ?? "?")}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.phone}
                          {member.flat_number && ` · Flat ${member.flat_number}`}
                        </p>
                      </div>
                      {/* Role selector */}
                      {canChange && member.id !== profile?.id ? (
                        <Select
                          value={member.role}
                          onValueChange={(val) => changeRoleMutation.mutate({ userId: member.id, newRole: val })}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_HOA.map((r) => {
                              const rd = ROLE_DEFS.find((x) => x.id === r);
                              return (
                                <SelectItem key={r} value={r}>
                                  <span className="flex items-center gap-2">
                                    {rd?.label ?? r}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${roleDef?.color ?? "bg-muted text-muted-foreground border-border"}`}>
                          {roleDef?.label ?? member.role}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          </TabsContent>

          {/* ── Role Reference Guide ───────────────────────────── */}
          <TabsContent value="reference" className="mt-6">
            <div className="space-y-3">
              {ROLE_DEFS.map((role) => {
                const isExpanded = expandedRole === role.id;
                const Icon = role.icon;
                const roleMembers = byRole[role.id] ?? [];
                return (
                  <Card key={role.id} className={`overflow-hidden transition-all ${isExpanded ? "border-primary/40" : ""}`}>
                    <button
                      className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${role.badge}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <p className="font-semibold text-sm">{role.label}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${role.badge}`}>
                            {roleMembers.length} assigned
                          </span>
                          {!role.assignable && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                              Platform-managed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                      </div>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 px-4 pb-4 pt-3 space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            Permissions & Access
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {role.permissions.map((p) => (
                              <div key={p} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {roleMembers.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                              Members with this role
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {roleMembers.map((m) => (
                                <span key={m.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${role.badge}`}>
                                  {getInitials(m.name ?? "?")} {m.name}
                                  {m.flat_number && <span className="opacity-70">· {m.flat_number}</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
