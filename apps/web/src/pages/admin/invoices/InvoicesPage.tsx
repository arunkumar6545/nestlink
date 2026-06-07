// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Download, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateInvoicesSchema, formatCurrency, formatDate, formatPeriod } from "@nestlink/core";
import type { z } from "zod";

type InvoiceForm = z.infer<typeof generateInvoicesSchema>;

export default function InvoicesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const societyId = profile?.society_id;

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["admin-invoices", societyId, statusFilter],
    queryFn: async () => {
      if (!societyId) return [];
      const flatIds = await getFlatIds(societyId);
      let q = supabase
        .from("invoices")
        .select(`
          *,
          flats:flat_id (number, floor, towers (name))
        `)
        .in("flat_id", flatIds)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const form = useForm<InvoiceForm>({
    resolver: zodResolver(generateInvoicesSchema),
    defaultValues: {
      society_id: societyId ?? "",
      period: new Date().toISOString().slice(0, 7),
      amount: 2500,
      due_date: "",
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (formData: InvoiceForm) => {
      const flatIds = await getFlatIds(formData.society_id);
      const invoices = flatIds.map((fid) => ({
        flat_id: fid,
        period: formData.period,
        amount: formData.amount,
        due_date: formData.due_date,
        late_fee: 0,
        status: "pending" as const,
      }));
      const { error } = await supabase.from("invoices").insert(invoices);
      if (error) throw error;
      return flatIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      toast.success(`Generated ${count} invoices`);
      setOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Maintenance Billing"
        description="Generate and track monthly maintenance invoices"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Generate Invoices
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Monthly Invoices</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit((d) => generateMutation.mutate(d))}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Period (YYYY-MM)</Label>
                    <Input type="month" {...form.register("period")} />
                    {form.formState.errors.period && (
                      <p className="text-xs text-destructive">{form.formState.errors.period.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number"
                      placeholder="2500"
                      {...form.register("amount", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" {...form.register("due_date")} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={generateMutation.isPending}>
                    <CreditCard className="h-4 w-4" />
                    {generateMutation.isPending ? "Generating..." : "Generate All"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Card>
          <CardContent className="p-0">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>
            )}
            {!isLoading && invoices?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">No invoices found</p>
            )}
            {invoices?.map((inv) => {
              const flat = inv.flats as { number: string; floor: number; towers: { name: string } | null } | null;
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-4 px-6 py-4 border-b last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {flat?.towers?.name} – Flat {flat?.number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPeriod(inv.period)} • Due {formatDate(inv.due_date)}
                    </p>
                  </div>
                  <p className="font-semibold text-sm">{formatCurrency(inv.amount)}</p>
                  {inv.late_fee > 0 && (
                    <p className="text-xs text-red-500">+{formatCurrency(inv.late_fee)} late fee</p>
                  )}
                  <StatusBadge status={inv.status} />
                  {inv.pdf_url && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function getFlatIds(societyId: string): Promise<string[]> {
  const { data } = await supabase
    .from("flats")
    .select("id, towers!inner(society_id)")
    .eq("towers.society_id", societyId);
  return (data ?? []).map((f) => f.id);
}
