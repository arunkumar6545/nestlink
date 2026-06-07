import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCallStore } from "@/store/call";

/**
 * Subscribes to incoming call_logs rows for the current user.
 * Must be mounted in a persistent layout (AppLayout) so it's always active.
 */
export function useIncomingCall() {
  const { profile } = useAuth();
  const { setIncomingCall, clearIncomingCall } = useCallStore();

  useEffect(() => {
    if (!profile?.id) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel(`calls-for-${profile.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "call_logs",
        filter: `callee_id=eq.${profile.id}`,
      }, async (payload: { new: Record<string, string> }) => {
        const log = payload.new;
        if (log.status !== "ringing") return;

        // Fetch caller profile for display
        const { data: caller } = await supabase
          .from("user_profiles")
          .select("id, name, avatar_url")
          .eq("id", log.caller_id)
          .single();

        setIncomingCall({
          callId: log.id,
          callerId: log.caller_id,
          callerName: caller?.name ?? "Unknown",
          callerAvatar: caller?.avatar_url ?? null,
          callType: log.call_type as "voice" | "video",
        });

        // Auto-miss after 30 seconds of no answer
        const missTimeout = setTimeout(async () => {
          await supabase
            .from("call_logs")
            .update({ status: "missed" })
            .eq("id", log.id)
            .eq("status", "ringing");
          clearIncomingCall();
        }, 30_000);

        // Watch for cancellation by caller
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const watchCancel = (supabase as any)
          .channel(`call-cancel-watch-${log.id}`)
          .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "call_logs",
            filter: `id=eq.${log.id}`,
          }, (update: { new: Record<string, string> }) => {
            if (["ended", "missed"].includes(update.new.status)) {
              clearTimeout(missTimeout);
              clearIncomingCall();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (supabase as any).removeChannel(watchCancel);
            }
          })
          .subscribe();
      })
      .subscribe();

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(channel);
    };
  }, [profile?.id, setIncomingCall, clearIncomingCall]);
}
