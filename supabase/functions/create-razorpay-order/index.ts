import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Unauthorized");

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id is required");

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, amount, late_fee, status, period")
      .eq("id", invoice_id)
      .single();

    if (error || !invoice) throw new Error("Invoice not found");
    if (invoice.status === "paid") throw new Error("Invoice already paid");

    const totalAmount = (invoice.amount + invoice.late_fee) * 100; // in paise

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      },
      body: JSON.stringify({
        amount: totalAmount,
        currency: "INR",
        receipt: `nestlink_${invoice_id}`,
        notes: {
          invoice_id,
          period: invoice.period,
        },
      }),
    });

    const order = await orderResponse.json();

    if (!order.id) throw new Error(order.description ?? "Failed to create Razorpay order");

    await supabase.from("payments").insert({
      invoice_id,
      razorpay_order_id: order.id,
      amount: invoice.amount + invoice.late_fee,
      status: "pending",
    });

    return new Response(JSON.stringify(order), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
