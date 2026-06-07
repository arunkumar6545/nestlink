// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, UserX, Search, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate, getInitials } from "@nestlink/core";

export default function ResidentsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const societyId = profile?.society_id;

  const { data: residents, isLoading } = useQuery({
    queryKey: ["admin-residents", societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data } = await supabase
        .from("residents")
        .select(`
          id, type, approved_at, created_at,
          user_profiles:user_id (id, name, phone, email, avatar_url),
          flats:flat_id (
            id, number, floor,
            towers (name)
          )
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const approveMutation = useMutation({
    mutationFn: async (residentId: string) => {
      const { error } = await supabase
        .from("residents")
        .update({ approved_at: new Date().toISOString() })
        .eq("id", residentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-residents"] });
      toast.success("Resident approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (residentId: string) => {
      const { error } = await supabase.from("residents").delete().eq("id", residentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-residents"] });
      toast.success("Resident removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = residents?.filter((r) => {
    const user = r.user_profiles as { name: string; phone: string } | null;
    const flat = r.flats as { number: string; towers: { name: string } | null } | null;
    const q = search.toLowerCase();
    return (
      user?.name?.toLowerCase().includes(q) ||
      user?.phone?.includes(q) ||
      flat?.number?.includes(q)
    );
  });

  const pending = filtered?.filter((r) => !r.approved_at);
  const approved = filtered?.filter((r) => !!r.approved_at);

  function ResidentRow({ r, showActions }: { r: typeof residents[0]; showActions: boolean }) {
    const user = r.user_profiles as { id: string; name: string; phone: string; email: string | null; avatar_url: string | null } | null;
    const flat = r.flats as { id: string; number: string; floor: number; towers: { name: string } | null } | null;

    return (
      <div className="flex items-center gap-4 py-4 px-6 border-b last:border-0 hover:bg-muted/30 transition-colors">
        <Avatar>
          <AvatarImage src={user?.avatar_url ?? undefined} />
          <AvatarFallback>{user?.name ? getInitials(user.name) : "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{user?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{user?.phone}</p>
        </div>
        <div className="hidden sm:block text-sm text-muted-foreground">
          {flat?.towers?.name} – Flat {flat?.number}, Floor {flat?.floor}
        </div>
        <StatusBadge status={r.type} />
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(r.created_at)}
        </div>
        {showActions && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate(r.id)}
              disabled={approveMutation.isPending}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => rejectMutation.mutate(r.id)}
              disabled={rejectMutation.isPending}
            >
              <UserX className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Residents" description="Manage resident onboarding and approvals" />

      <div className="p-8 space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, flat..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pending?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approved?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading && (
                  <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
                )}
                {!isLoading && pending?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">No pending approvals</p>
                )}
                {pending?.map((r) => (
                  <ResidentRow key={r.id} r={r} showActions={true} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading && (
                  <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
                )}
                {!isLoading && approved?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">No approved residents</p>
                )}
                {approved?.map((r) => (
                  <ResidentRow key={r.id} r={r} showActions={false} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
