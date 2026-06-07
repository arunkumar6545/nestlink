// @ts-nocheck
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, QrCode, Copy, CheckCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createVisitorSchema, formatDateTime, generateOtp, generateQrToken } from "@nestlink/core";
import type { z } from "zod";

type VisitorForm = Omit<z.infer<typeof createVisitorSchema>, "flat_id">;

export default function VisitorsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [createdPass, setCreatedPass] = useState<{ otp: string; qr_token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: passes, isLoading } = useRealtimeQuery("visitors", {
    queryKey: ["resident-visitor-passes", profile?.id],
    pollIntervalMs: 10_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("visitor_passes")
        .select(`
          id, otp, qr_token, valid_from, valid_until, status,
          visitors:visitor_id (name, phone, purpose)
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const form = useForm<VisitorForm>({
    resolver: zodResolver(createVisitorSchema.omit({ flat_id: true })),
    defaultValues: {
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: VisitorForm) => {
      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) throw new Error("Resident not found");

      const { data: visitor, error: vErr } = await supabase
        .from("visitors")
        .insert({
          society_id: profile!.society_id!,
          name: data.name,
          phone: data.phone,
          purpose: data.purpose,
          photo_url: data.photo_url ?? null,
        })
        .select()
        .single();

      if (vErr || !visitor) throw vErr ?? new Error("Failed to create visitor");

      const otp = generateOtp();
      const qr_token = generateQrToken();

      const { data: pass, error: pErr } = await supabase
        .from("visitor_passes")
        .insert({
          visitor_id: visitor.id,
          flat_id: resident.flat_id,
          qr_token,
          otp,
          valid_from: data.valid_from,
          valid_until: data.valid_until,
          status: "active",
        })
        .select()
        .single();

      if (pErr || !pass) throw pErr ?? new Error("Failed to create pass");
      return { otp, qr_token };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["resident-visitor-passes"] });
      setCreatedPass(result);
      toast.success("Visitor pass created");
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyOtp() {
    if (createdPass) {
      navigator.clipboard.writeText(createdPass.otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Visitor Management"
        description="Pre-approve visitors and manage entry passes"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreatedPass(null); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Invite Visitor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {createdPass ? "Visitor Pass Created!" : "Invite Visitor"}
                </DialogTitle>
              </DialogHeader>

              {createdPass ? (
                <div className="space-y-6 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                      <QrCode className="h-10 w-10 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Share this OTP with your visitor</p>
                  </div>
                  <div className="rounded-xl bg-muted p-6">
                    <p className="text-4xl font-bold tracking-widest text-primary">{createdPass.otp}</p>
                    <p className="text-xs text-muted-foreground mt-2">6-digit OTP</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={copyOtp}>
                      {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied!" : "Copy OTP"}
                    </Button>
                    <Button className="flex-1" onClick={() => { setOpen(false); setCreatedPass(null); }}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Visitor Name</Label>
                    <Input placeholder="John Doe" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input placeholder="+91 9876543210" {...form.register("phone")} />
                    {form.formState.errors.phone && (
                      <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Purpose of Visit</Label>
                    <Input placeholder="Meeting, Delivery, etc." {...form.register("purpose")} />
                    {form.formState.errors.purpose && (
                      <p className="text-xs text-destructive">{form.formState.errors.purpose.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Valid From</Label>
                      <Input
                        type="datetime-local"
                        defaultValue={new Date().toISOString().slice(0, 16)}
                        onChange={(e) => form.setValue("valid_from", new Date(e.target.value).toISOString())}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valid Until</Label>
                      <Input
                        type="datetime-local"
                        defaultValue={new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                        onChange={(e) => form.setValue("valid_until", new Date(e.target.value).toISOString())}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Generate Pass"}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>}
        {!isLoading && passes?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-20">No visitor passes yet</p>
        )}
        {passes?.map((p) => {
          const visitor = p.visitors as { name: string; phone: string; purpose: string } | null;
          return (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <QrCode className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{visitor?.name}</p>
                    <p className="text-xs text-muted-foreground">{visitor?.purpose} • {visitor?.phone}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(p.valid_from)} – {formatDateTime(p.valid_until)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={p.status} />
                    <p className="text-xs font-mono text-muted-foreground">OTP: {p.otp}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
