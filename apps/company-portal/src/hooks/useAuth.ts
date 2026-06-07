import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      store.setUser(user ? { id: user.id } : null);
      if (user) fetchProfile(user.id);
      else store.setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      store.setUser(user ? { id: user.id } : null);
      if (user) fetchProfile(user.id);
      else { store.setProfile(null); store.setLoading(false); }
    });

    return () => listener.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, name, phone, role, avatar_url")
      .eq("id", userId)
      .single();
    store.setProfile(data ?? null);
    store.setLoading(false);
  }

  return {
    user: store.user,
    profile: store.profile,
    isLoading: store.isLoading,
    signOut: store.signOut,
  };
}
