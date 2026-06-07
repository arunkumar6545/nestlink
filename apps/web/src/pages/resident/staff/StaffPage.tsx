// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, UserCheck, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createStaffSchema, getInitials, formatDateTime } from "@nestlink/core";
import type { z } from "zod";

type StaffForm = z.infer<typeof createStaffSchema>;

const categoryLabels: Record<string, string> = {
  maid: "🧹 Maid",
  cook: "👨‍🍳 Cook",
  driver: "🚗 Driver",
  gardener: "🌱 Gardener",
  watchman: "💂 Watchman",
  other: "👤 Other",
};

export default function StaffPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: staff, isLoading } = useQuery({
    queryKey: ["domestic-staff", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("domestic_staff")
        .select("*")
        .eq("society_id", profile!.society_id!)
        .order("name");
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const { data: recentAttendance } = useQuery({
    queryKey: ["staff-attendance", profile?.id],
    queryFn: async () => {
      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) return [];

      const { data } = await supabase
        .from("staff_attendance")
        .select(`*, domestic_staff:staff_id (name, category)`)
        .eq("flat_id", resident.flat_id)
        .order("checkin_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const form = useForm<StaffForm>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { society_id: profile?.society_id ?? "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StaffForm) => {
      const { error } = await supabase.from("domestic_staff").insert({
        ...data,
        verified: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domestic-staff"] });
      toast.success("Staff member added");
      setOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Domestic Staff"
        description="Manage your domestic staff members"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="Staff member name" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+91 9876543210" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select onValueChange={(v) => form.setValue("category", v as StaffForm["category"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.category && (
                    <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Adding..." : "Add Staff"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Staff Members ({staff?.length ?? 0})
          </h2>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff?.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(s.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{categoryLabels[s.category]}</p>
                      <p className="text-xs text-muted-foreground">{s.phone}</p>
                    </div>
                    {s.verified && (
                      <div className="ml-auto">
                        <UserCheck className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {recentAttendance && recentAttendance.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Recent Attendance
            </h2>
            <Card>
              <CardContent className="p-0">
                {recentAttendance.map((a) => {
                  const s = a.domestic_staff as { name: string; category: string } | null;
                  return (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s?.category}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>In: {formatDateTime(a.checkin_at)}</p>
                        {a.checkout_at && <p>Out: {formatDateTime(a.checkout_at)}</p>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
