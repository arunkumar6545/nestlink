import { create } from "zustand";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  name: string;
  phone: string;
  role: string;
  avatar_url: string | null;
}

interface AuthState {
  user: { id: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  setUser: (u: AuthState["user"]) => void;
  setProfile: (p: Profile | null) => void;
  setLoading: (v: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },
}));
