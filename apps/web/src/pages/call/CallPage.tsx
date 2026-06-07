// @ts-nocheck
import { useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Phone, Loader2, AlertCircle, PhoneMissed,
} from "lucide-react";
import { useWebRTC, type CallStatus } from "@/hooks/useWebRTC";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getInitials } from "@nestlink/core";
import { cn } from "@/lib/utils";

export default function CallPage() {
  const { callId } = useParams<{ callId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const callType = (params.get("type") ?? "video") as "voice" | "video";
  const isCallee  = params.get("role") === "callee";
  const otherId   = params.get("callee") ?? params.get("caller") ?? "";

  // ── Fetch the other person's info ─────────────────────────────
  const { data: other } = useQuery({
    queryKey: ["call-other", otherId],
    queryFn: async () => {
      if (!otherId) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, avatar_url")
        .eq("id", otherId)
        .single();
      return data;
    },
    enabled: !!otherId,
  });

  // ── WebRTC ────────────────────────────────────────────────────
  const {
    localVideoRef, remoteVideoRef,
    status, isMuted, isCameraOff, callDuration,
    toggleMute, toggleCamera, endCall,
  } = useWebRTC({
    callId: callId!,
    isInitiator: !isCallee,
    callType,
    onCallEnded: () => navigate(-1),
  });

  // ── End call and navigate back ─────────────────────────────────
  async function handleEnd() {
    await endCall();
    navigate(-1);
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center overflow-hidden">

      {/* ── Remote video (full screen) ─────────────────────── */}
      {callType === "video" ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            status === "connected" ? "opacity-100" : "opacity-0"
          )}
        />
      ) : (
        /* Voice call — show avatar full screen */
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt={other.name} className="h-40 w-40 rounded-full object-cover ring-4 ring-white/20 blur-none" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-full bg-primary/20 text-white text-6xl font-bold ring-4 ring-white/20">
              {getInitials(other?.name ?? "?")}
            </div>
          )}
        </div>
      )}

      {/* ── Dark gradient overlays ──────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {/* ── Top: name + status ─────────────────────────────── */}
      <div className="absolute top-8 left-0 right-0 flex flex-col items-center gap-2 z-10 text-white text-center px-4">
        {other?.avatar_url && callType === "voice" ? null : (
          other && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm mb-1">
              {other.avatar_url ? (
                <img src={other.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="text-lg font-bold">{getInitials(other.name)}</span>
              )}
            </div>
          )
        )}
        <p className="text-xl font-bold drop-shadow-lg">{other?.name ?? "Connecting…"}</p>
        <StatusLabel status={status} duration={callDuration} />
      </div>

      {/* ── Local video (PiP corner) ────────────────────────── */}
      {callType === "video" && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute bottom-28 right-4 w-32 h-44 rounded-2xl object-cover ring-2 ring-white/30 shadow-xl z-20 transition-opacity",
            isCameraOff ? "opacity-0" : "opacity-100"
          )}
        />
      )}

      {/* ── Controls bar ───────────────────────────────────── */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4 z-20">
        {/* Mute */}
        <ControlButton
          onClick={toggleMute}
          active={isMuted}
          icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          label={isMuted ? "Unmute" : "Mute"}
        />

        {/* Camera (video calls only) */}
        {callType === "video" && (
          <ControlButton
            onClick={toggleCamera}
            active={isCameraOff}
            icon={isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            label={isCameraOff ? "Camera On" : "Camera Off"}
          />
        )}

        {/* End call */}
        <button
          onClick={handleEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-xl hover:bg-red-600 transition-all active:scale-95"
          title="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>

      {/* ── Connecting overlay ─────────────────────────────── */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-30 bg-gray-950">
          <Loader2 className="h-10 w-10 animate-spin text-white/60" />
          <p className="text-white/60 text-sm">Setting up secure connection…</p>
        </div>
      )}

      {/* ── Error overlay ──────────────────────────────────── */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-30 bg-gray-950">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-white font-semibold">Could not start call</p>
          <p className="text-white/60 text-sm text-center px-8">
            Make sure camera/mic permissions are granted in your browser settings.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 rounded-xl bg-white/10 px-6 py-2.5 text-white text-sm hover:bg-white/20 transition-colors"
          >
            Go Back
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function StatusLabel({ status, duration }: { status: CallStatus; duration: string }) {
  const map: Record<CallStatus, { text: string; cls: string }> = {
    connecting: { text: "Connecting…", cls: "text-white/60" },
    ringing:    { text: "Ringing…",    cls: "text-amber-400 animate-pulse" },
    connected:  { text: duration,      cls: "text-emerald-400 font-mono" },
    ended:      { text: "Call ended",  cls: "text-white/60" },
    error:      { text: "Error",       cls: "text-red-400" },
  };
  const { text, cls } = map[status] ?? map.connecting;
  return <p className={cn("text-sm drop-shadow", cls)}>{text}</p>;
}

function ControlButton({
  onClick, active, icon, label,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 group",
      )}
      title={label}
    >
      <span className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-95 shadow-lg",
        active
          ? "bg-white/20 ring-2 ring-white/40"
          : "bg-white/10 hover:bg-white/20"
      )}>
        <span className="text-white">{icon}</span>
      </span>
      <span className="text-[10px] text-white/60">{label}</span>
    </button>
  );
}
