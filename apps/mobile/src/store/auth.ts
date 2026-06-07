import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";

type UserRole =
  | "resident"
  | "admin"
  | "guard"
  | "staff"
  | "super_admin"
  | "hoa_president"
  | "hoa_secretary"
  | "hoa_treasurer"
  | "hoa_member";

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  avatar_url: string | null;
  society_id: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, session: null, profile: null }),
}));
