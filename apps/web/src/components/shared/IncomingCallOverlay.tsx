import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCallStore } from "@/store/call";
import { useIncomingCall } from "@/hooks/useIncomingCall";
import { getInitials } from "@nestlink/core";

/** Must be mounted once inside AppLayout. Renders nothing when no call is incoming. */
export function IncomingCallOverlay() {
  // Registers the global subscription
  useIncomingCall();

  const navigate = useNavigate();
  const { incomingCall, clearIncomingCall } = useCallStore();

  if (!incomingCall) return null;

  async function accept() {
    clearIncomingCall();
    navigate(
      `/call/${incomingCall!.callId}?role=callee&caller=${incomingCall!.callerId}&type=${incomingCall!.callType}`
    );
  }

  async function decline() {
    await supabase.from("call_logs").update({ status: "rejected" }).eq("id", incomingCall!.callId);
    clearIncomingCall();
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80 rounded-2xl bg-gray-900 text-white shadow-2xl ring-1 ring-white/10 overflow-hidden animate-in slide-in-from-top-4">
      {/* Ambient glow for video */}
      {incomingCall.callType === "video" && (
        <div className="absolute inset-0 bg-sky-900/40 blur-2xl pointer-events-none" />
      )}

      <div className="relative p-4 flex items-center gap-4">
        {/* Avatar */}
        {incomingCall.callerAvatar ? (
          <img
            src={incomingCall.callerAvatar}
            alt={incomingCall.callerName}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-white/20 shrink-0"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-xl font-bold ring-2 ring-white/20 shrink-0">
            {getInitials(incomingCall.callerName)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/60 mb-0.5">
            {incomingCall.callType === "video" ? "Incoming Video Call" : "Incoming Voice Call"}
          </p>
          <p className="font-bold text-base truncate">{incomingCall.callerName}</p>

          {/* Pulse animation */}
          <div className="flex items-center gap-1 mt-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-emerald-400 animate-pulse"
                style={{
                  height: `${6 + (i % 3) * 4}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Accept / Decline */}
      <div className="relative flex border-t border-white/10">
        <button
          onClick={decline}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-red-400 hover:bg-white/5 transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
          Decline
        </button>
        <div className="w-px bg-white/10" />
        <button
          onClick={accept}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-emerald-400 hover:bg-white/5 transition-colors"
        >
          {incomingCall.callType === "video"
            ? <Video className="h-4 w-4" />
            : <Phone className="h-4 w-4" />}
          Accept
        </button>
      </div>
    </div>
  );
}
