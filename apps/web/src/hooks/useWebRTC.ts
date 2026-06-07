import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type CallStatus = "connecting" | "ringing" | "connected" | "ended" | "error";

interface UseWebRTCParams {
  callId: string;
  isInitiator: boolean;
  callType: "voice" | "video";
  onCallEnded?: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export function useWebRTC({ callId, isInitiator, callType, onCallEnded }: UseWebRTCParams) {
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef  = useRef<RTCIceCandidateInit[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iceChannelRef  = useRef<any>(null);

  const [status,      setStatus]      = useState<CallStatus>("connecting");
  const [isMuted,     setIsMuted]     = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration,    setDuration]    = useState(0);

  // ── Helpers ─────────────────────────────────────────────────────

  const cleanupPeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingIceRef.current = [];
    if (iceChannelRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(iceChannelRef.current);
      iceChannelRef.current = null;
    }
  }, []);

  const attachRemoteStream = useCallback((streams: readonly MediaStream[]) => {
    if (remoteVideoRef.current && streams[0]) {
      remoteVideoRef.current.srcObject = streams[0];
      remoteVideoRef.current.play().catch(() => {/* autoplay blocked - user will interact */});
    }
  }, []);

  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore stale */ }
    }
  }, []);

  // ── Setup ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!callId) return;
    let cancelled = false;
    let durationTimer: ReturnType<typeof setInterval> | null = null;

    async function setup() {
      try {
        // 1. Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === "video"
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
            : false,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // prevent echo
        }

        // 2. Create peer connection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        if (cancelled) { pc.close(); return; }
        pcRef.current = pc;

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (e) => attachRemoteStream(e.streams);

        // 3. ICE candidates via Supabase Realtime broadcast
        const iceChannel = (supabase as any)
          .channel(`call-ice-${callId}`)
          .on("broadcast", { event: "ice" }, async ({ payload }: { payload: { candidate: RTCIceCandidateInit } }) => {
            if (!pcRef.current) return;
            if (pcRef.current.remoteDescription) {
              try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)); }
              catch { /* stale candidate */ }
            } else {
              pendingIceRef.current.push(payload.candidate);
            }
          })
          .subscribe();
        iceChannelRef.current = iceChannel;

        pc.onicecandidate = ({ candidate }) => {
          if (candidate && iceChannelRef.current) {
            iceChannelRef.current.send({
              type: "broadcast",
              event: "ice",
              payload: { candidate: candidate.toJSON() },
            });
          }
        };

        // 4. Connection state changes
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === "connected") {
            setStatus("connected");
            durationTimer = setInterval(() => setDuration((d) => d + 1), 1000);
          }
          if (["disconnected", "failed", "closed"].includes(s)) {
            if (durationTimer) clearInterval(durationTimer);
            setStatus("ended");
            onCallEnded?.();
          }
        };

        // 5. Signaling: offer/answer via Supabase DB (reliable delivery)
        if (isInitiator) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === "video",
          });
          await pc.setLocalDescription(offer);

          // Store offer in DB
          await supabase.from("call_logs")
            .update({ sdp_offer: JSON.stringify(offer) })
            .eq("id", callId);

          setStatus("ringing");

          // Watch for answer via Realtime
          const answerChannel = (supabase as any)
            .channel(`call-answer-${callId}`)
            .on("postgres_changes", {
              event: "UPDATE",
              schema: "public",
              table: "call_logs",
              filter: `id=eq.${callId}`,
            }, async ({ new: log }: { new: Record<string, string> }) => {
              if (log.sdp_answer && pcRef.current && !pcRef.current.remoteDescription) {
                await pcRef.current.setRemoteDescription(
                  new RTCSessionDescription(JSON.parse(log.sdp_answer))
                );
                await flushPendingCandidates(pcRef.current);
              }
              if (log.status === "rejected" || log.status === "missed") {
                if (durationTimer) clearInterval(durationTimer);
                setStatus("ended");
                onCallEnded?.();
              }
            })
            .subscribe();

          // Cleanup answer channel on unmount
          return () => { (supabase as any).removeChannel(answerChannel); };

        } else {
          // Callee: read offer from DB
          const { data: log } = await supabase
            .from("call_logs")
            .select("sdp_offer")
            .eq("id", callId)
            .single();

          if (!log?.sdp_offer) { setStatus("error"); return; }

          await pc.setRemoteDescription(
            new RTCSessionDescription(JSON.parse(log.sdp_offer))
          );
          await flushPendingCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Store answer + mark accepted
          await supabase.from("call_logs").update({
            sdp_answer: JSON.stringify(answer),
            status: "accepted",
            accepted_at: new Date().toISOString(),
          }).eq("id", callId);
        }

      } catch (err) {
        if (!cancelled) {
          console.error("WebRTC error:", err);
          setStatus("error");
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (durationTimer) clearInterval(durationTimer);
      cleanupPeer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // ── Controls ─────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCameraOff(!track.enabled);
  }, []);

  const endCall = useCallback(async () => {
    await supabase.from("call_logs").update({
      status: "ended",
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
    }).eq("id", callId);
    cleanupPeer();
    setStatus("ended");
    onCallEnded?.();
  }, [callId, duration, cleanupPeer, onCallEnded]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return {
    localVideoRef,
    remoteVideoRef,
    status,
    isMuted,
    isCameraOff,
    callDuration: formatDuration(duration),
    toggleMute,
    toggleCamera,
    endCall,
  };
}
