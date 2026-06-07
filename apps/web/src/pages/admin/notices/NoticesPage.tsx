// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pin, Bell, Trash2 } from "lucide-react";
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
import { createNoticeSchema, formatRelative } from "@nestlink/core";
import type { z } from "zod";

type NoticeForm = z.infer<typeof createNoticeSchema>;

export default function NoticesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const societyId = profile?.society_id;

  const { data: notices, isLoading } = useQuery({
    queryKey: ["admin-notices", societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data } = await supabase
        .from("notices")
        .select("*")
        .eq("society_id", societyId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const form = useForm<NoticeForm>({
    resolver: zodResolver(createNoticeSchema),
    defaultValues: { type: "info", pinned: false },
  });

  const createMutation = useMutation({
    mutationFn: async (data: NoticeForm) => {
      const { error } = await supabase.from("notices").insert({
        ...data,
        society_id: societyId!,
        created_by: profile!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      toast.success("Notice created and sent");
      setOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      toast.success("Notice deleted");
    },
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notices & Announcements"
        description="Broadcast notices to all residents"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                New Notice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Notice</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="Notice title..." {...form.register("title")} />
                  {form.formState.errors.title && (
                    <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Write your announcement here..."
                    rows={5}
                    {...form.register("body")}
                  />
                  {form.formState.errors.body && (
                    <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      defaultValue="info"
                      onValueChange={(v) => form.setValue("type", v as "info" | "urgent" | "event")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pin to top?</Label>
                    <Select
                      defaultValue="false"
                      onValueChange={(v) => form.setValue("pinned", v === "true")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">No</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    <Bell className="h-4 w-4" />
                    {createMutation.isPending ? "Sending..." : "Send Notice"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-4">
        {isLoading && <p className="text-muted-foreground text-sm text-center py-10">Loading...</p>}
        {!isLoading && notices?.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-20">No notices yet. Create the first one!</p>
        )}
        {notices?.map((notice) => (
          <Card key={notice.id} className={notice.pinned ? "border-primary/40 bg-primary/5" : ""}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {notice.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                    <h3 className="font-semibold text-sm">{notice.title}</h3>
                    <StatusBadge status={notice.type} />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {notice.body}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatRelative(notice.created_at)}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive shrink-0"
                  onClick={() => deleteMutation.mutate(notice.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
