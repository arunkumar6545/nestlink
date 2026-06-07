// @ts-nocheck
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { Search, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatRelative, formatDate } from "@nestlink/core";

type Complaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
  due_date: string | null;
  flat_id: string;
};

export default function ComplaintsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const societyId = profile?.society_id;

  const { data: complaints, isLoading } = useRealtimeQuery<Complaint[]>("complaints", {
    queryKey: ["admin-complaints", societyId, statusFilter],
    queryFn: async () => {
      if (!societyId) return [];
      let q = supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data } = await q;
      return (data ?? []) as Complaint[];
    },
    enabled: !!societyId,
    pollIntervalMs: 15_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("complaints")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-complaints"] });
      toast.success("Complaint status updated");
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = complaints?.filter((c) => {
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Complaints"
        description="Track and manage resident complaints"
      />

      <div className="p-8 space-y-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search complaints..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
            )}
            {!isLoading && filtered?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">No complaints found</p>
            )}
            {filtered?.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 px-6 py-4 border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSelected(c)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.category} • {formatRelative(c.created_at)}
                  </p>
                </div>
                <StatusBadge status={c.priority} />
                <StatusBadge status={c.status} />
                <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={selected.status} />
                <StatusBadge status={selected.priority} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selected.description}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p className="font-medium">{selected.category}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Raised On</Label>
                  <p className="font-medium">{formatDate(selected.created_at)}</p>
                </div>
              </div>
              {selected.photo_urls?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Photos</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {selected.photo_urls.map((url, i) => (
                      <img key={i} src={url} className="h-20 w-20 object-cover rounded-lg" alt="complaint" />
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Update Status</Label>
                <Select
                  value={selected.status}
                  onValueChange={(v) => updateMutation.mutate({ id: selected.id, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
