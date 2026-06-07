// @ts-nocheck
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const { user, session, profile, isLoading, setUser, setSession, setProfile, setLoading, signOut } =
    useAuthStore();

  useEffect(() => {
    // Guard: if session fetch errors (e.g. local Supabase not running), stop loading
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, name, phone, email, role, avatar_url, society_id")
        .eq("id", userId)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch {
      // Supabase unreachable — profile stays null, user will see login
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut().catch(() => {});
    signOut();
  }

  return { user, session, profile, isLoading, signOut: handleSignOut };
}
