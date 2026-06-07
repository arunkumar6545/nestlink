import { create } from "zustand";

export interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  callType: "voice" | "video";
}

interface CallStore {
  incomingCall: IncomingCallData | null;
  setIncomingCall: (data: IncomingCallData) => void;
  clearIncomingCall: () => void;
}

export const useCallStore = create<CallStore>((set) => ({
  incomingCall: null,
  setIncomingCall: (data) => set({ incomingCall: data }),
  clearIncomingCall: () => set({ incomingCall: null }),
}));
