// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Download, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatPeriod } from "@nestlink/core";
import { toast } from "sonner";

export default function PaymentsPage() {
  const { profile } = useAuth();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["resident-invoices", profile?.id],
    queryFn: async () => {
      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) return [];

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("flat_id", resident.flat_id)
        .order("period", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  async function handlePay(invoiceId: string, amount: number) {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });

      const order = await response.json();

      if (!order.id) throw new Error(order.error ?? "Failed to create order");

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Nestlink",
        description: "Maintenance Payment",
        order_id: order.id,
        handler: () => {
          toast.success("Payment successful!");
        },
        prefill: {
          name: profile?.name,
          contact: profile?.phone,
          email: profile?.email ?? "",
        },
        theme: { color: "#0ea5e9" },
      };

      // @ts-expect-error - Razorpay global
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pending = invoices?.filter((i) => i.status === "pending" || i.status === "overdue") ?? [];
  const paid = invoices?.filter((i) => i.status === "paid") ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Maintenance Payments"
        description="View and pay your maintenance invoices"
      />

      <div className="p-8 space-y-8">
        {/* Summary */}
        {pending.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-semibold text-amber-900 mb-1">Outstanding Dues</h3>
            <p className="text-2xl font-bold text-amber-800">
              {formatCurrency(pending.reduce((sum, i) => sum + i.amount + i.late_fee, 0))}
            </p>
            <p className="text-sm text-amber-700 mt-1">{pending.length} invoice(s) pending</p>
          </div>
        )}

        {/* Pending Invoices */}
        {pending.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Due Invoices
            </h2>
            <div className="space-y-3">
              {pending.map((inv) => (
                <Card key={inv.id} className="border-amber-200">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">{formatPeriod(inv.period)}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {formatDate(inv.due_date)}
                        </p>
                        {inv.late_fee > 0 && (
                          <p className="text-xs text-red-500 mt-0.5">
                            + {formatCurrency(inv.late_fee)} late fee
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatCurrency(inv.amount)}</p>
                        <StatusBadge status={inv.status} className="mt-1" />
                      </div>
                      <Button onClick={() => handlePay(inv.id, inv.amount + inv.late_fee)}>
                        Pay Now
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Paid Invoices */}
        {paid.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Payment History
            </h2>
            <Card>
              <CardContent className="p-0">
                {paid.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-0">
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{formatPeriod(inv.period)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.due_date)}</p>
                    </div>
                    <p className="font-semibold text-sm">{formatCurrency(inv.amount)}</p>
                    <StatusBadge status={inv.status} />
                    {inv.pdf_url && (
                      <Button size="icon" variant="ghost" asChild>
                        <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>}
        {!isLoading && invoices?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-20">No invoices yet</p>
        )}
      </div>
    </div>
  );
}
