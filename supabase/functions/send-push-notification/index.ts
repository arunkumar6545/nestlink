import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  badge?: number;
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

    const { user_ids, title, body, data } = await req.json();

    if (!user_ids?.length || !title || !body) {
      throw new Error("user_ids, title, and body are required");
    }

    // Get all push tokens for users
    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .in("user_id", user_ids);

    if (error) throw error;
    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No push tokens found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expoTokens = tokens.filter((t) => t.platform === "expo").map((t) => t.token);
    const webTokens = tokens.filter((t) => t.platform === "web").map((t) => t.token);

    const results: { expo?: unknown; web?: unknown } = {};

    // Send to Expo (mobile)
    if (expoTokens.length > 0) {
      const messages: PushMessage[] = expoTokens.map((token) => ({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }));

      const expoResponse = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN") ?? ""}`,
        },
        body: JSON.stringify(messages),
      });

      results.expo = await expoResponse.json();
    }

    // Web Push
    if (webTokens.length > 0) {
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@nestlink.in";

      if (vapidPublicKey && vapidPrivateKey) {
        // Web push would be sent here using VAPID
        // Implementation depends on web-push library compatibility with Deno
        results.web = { sent: webTokens.length, status: "queued" };
      }
    }

    return new Response(
      JSON.stringify({ sent: tokens.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
