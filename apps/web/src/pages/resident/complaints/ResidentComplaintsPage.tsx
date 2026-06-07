// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Image, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createComplaintSchema, complaintCategories, formatRelative } from "@nestlink/core";
import type { z } from "zod";

type ComplaintForm = z.infer<typeof createComplaintSchema>;

export default function ResidentComplaintsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["resident-complaints", profile?.id],
    queryFn: async () => {
      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) return [];

      const { data } = await supabase
        .from("complaints")
        .select("*")
        .eq("flat_id", resident.flat_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const form = useForm<ComplaintForm>({
    resolver: zodResolver(createComplaintSchema),
    defaultValues: { priority: "medium", photo_urls: [] },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ComplaintForm) => {
      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) throw new Error("Resident not found");

      const { error } = await supabase.from("complaints").insert({
        ...data,
        flat_id: resident.flat_id,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident-complaints"] });
      toast.success("Complaint raised successfully");
      setOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My Complaints"
        description="Raise and track maintenance complaints"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Raise Complaint
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Raise a Complaint</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="Brief description of issue" {...form.register("title")} />
                  {form.formState.errors.title && (
                    <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select onValueChange={(v) => form.setValue("category", v as typeof complaintCategories[number])}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {complaintCategories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.category && (
                      <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      defaultValue="medium"
                      onValueChange={(v) => form.setValue("priority", v as "low" | "medium" | "high" | "critical")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe the issue in detail..."
                    rows={4}
                    {...form.register("description")}
                  />
                  {form.formState.errors.description && (
                    <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Submitting..." : "Submit Complaint"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>}
        {!isLoading && complaints?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-20">No complaints raised yet</p>
        )}
        {complaints?.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {c.category} • {formatRelative(c.created_at)}
                  </p>
                  {c.photo_urls?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Image className="h-3 w-3" />
                      {c.photo_urls.length} photo(s)
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={c.status} />
                  <StatusBadge status={c.priority} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
