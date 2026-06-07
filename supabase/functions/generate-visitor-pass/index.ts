import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateQrToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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

    const {
      visitor_name,
      visitor_phone,
      purpose,
      flat_id,
      society_id,
      valid_from,
      valid_until,
    } = await req.json();

    // Create or find visitor
    let { data: visitor } = await supabase
      .from("visitors")
      .select("id")
      .eq("phone", visitor_phone)
      .eq("society_id", society_id)
      .single();

    if (!visitor) {
      const { data: newVisitor, error } = await supabase
        .from("visitors")
        .insert({ name: visitor_name, phone: visitor_phone, purpose, society_id })
        .select()
        .single();
      if (error || !newVisitor) throw error ?? new Error("Failed to create visitor");
      visitor = newVisitor;
    }

    const otp = generateOtp();
    const qr_token = generateQrToken();

    const { data: pass, error: passError } = await supabase
      .from("visitor_passes")
      .insert({
        visitor_id: visitor.id,
        flat_id,
        qr_token,
        otp,
        valid_from: valid_from ?? new Date().toISOString(),
        valid_until: valid_until ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (passError || !pass) throw passError ?? new Error("Failed to create pass");

    // Notify resident via push notification
    await supabase.functions.invoke("send-push-notification", {
      body: {
        user_ids: [user.id],
        title: "Visitor Pass Created",
        body: `Pass created for ${visitor_name}. OTP: ${otp}`,
        data: { type: "visitor_pass", pass_id: pass.id },
      },
    });

    return new Response(
      JSON.stringify({ pass_id: pass.id, otp, qr_token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
