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

    const { otp, action, notes } = await req.json();

    if (!otp || !action) throw new Error("otp and action are required");
    if (!["checkin", "checkout"].includes(action)) throw new Error("action must be checkin or checkout");

    // Find active pass by OTP
    const { data: pass, error: passError } = await supabase
      .from("visitor_passes")
      .select(`
        id, status, valid_until, flat_id,
        visitors:visitor_id (id, name, phone, purpose),
        flats:flat_id (number, towers (name))
      `)
      .eq("otp", otp)
      .eq("status", "active")
      .single();

    if (passError || !pass) throw new Error("Invalid or expired OTP");

    // Check expiry
    const now = new Date();
    if (now > new Date(pass.valid_until)) {
      await supabase.from("visitor_passes").update({ status: "expired" }).eq("id", pass.id);
      throw new Error("Visitor pass has expired");
    }

    // Get guard's profile to confirm role
    const { data: guard } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (guard?.role !== "guard") throw new Error("Only guards can verify OTPs");

    // Log the action
    await supabase.from("visitor_logs").insert({
      pass_id: pass.id,
      guard_id: user.id,
      action,
      timestamp: now.toISOString(),
      notes: notes ?? null,
    });

    // Update pass status on check-in
    if (action === "checkin") {
      await supabase.from("visitor_passes").update({ status: "used" }).eq("id", pass.id);
    }

    // Get resident to notify
    const { data: resident } = await supabase
      .from("residents")
      .select("user_id")
      .eq("flat_id", pass.flat_id)
      .not("approved_at", "is", null)
      .limit(1)
      .single();

    const visitor = pass.visitors as { name: string; purpose: string } | null;
    const flat = pass.flats as { number: string; towers: { name: string } | null } | null;

    if (resident) {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: [resident.user_id],
          title: action === "checkin" ? "Visitor Arrived" : "Visitor Departed",
          body:
            action === "checkin"
              ? `${visitor?.name} has arrived at your flat`
              : `${visitor?.name} has left`,
          data: { type: action === "checkin" ? "visitor_arrival" : "visitor_departure" },
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        visitor: {
          name: visitor?.name,
          purpose: visitor?.purpose,
          flat: `${flat?.towers?.name} – Flat ${flat?.number}`,
        },
        action,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
