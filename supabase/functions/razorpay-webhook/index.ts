import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";
import { createHmac } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

    // Verify signature
    const expectedSignature = createHmac("sha256", secret)
      .update(body)
      .toString("hex");

    if (signature !== expectedSignature) {
      throw new Error("Invalid webhook signature");
    }

    const event = JSON.parse(body);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const { data: paymentRecord } = await supabase
        .from("payments")
        .select("id, invoice_id")
        .eq("razorpay_order_id", orderId)
        .single();

      if (paymentRecord) {
        await supabase
          .from("payments")
          .update({
            razorpay_payment_id: payment.id,
            status: "success",
            paid_at: new Date().toISOString(),
          })
          .eq("id", paymentRecord.id);

        await supabase
          .from("invoices")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", paymentRecord.invoice_id);

        // Send push notification
        await supabase.functions.invoke("send-push-notification", {
          body: {
            invoice_id: paymentRecord.invoice_id,
            type: "payment_success",
            amount: payment.amount / 100,
          },
        });
      }
    } else if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("razorpay_order_id", payment.order_id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
