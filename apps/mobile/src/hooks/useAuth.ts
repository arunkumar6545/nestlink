import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    // Guard: if session fetch fails (local Supabase not running), stop loading
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          store.setLoading(false);
          return;
        }
        store.setSession(session);
        store.setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          store.setLoading(false);
        }
      })
      .catch(() => store.setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      store.setSession(session);
      store.setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        store.setProfile(null);
        store.setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(userId: string) {
    store.setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, name, phone, email, role, avatar_url, society_id")
        .eq("id", userId)
        .single();

      if (!error && data) {
        store.setProfile(data);
      } else {
        // Profile doesn't exist yet — check invitations table
        const { data: inv } = await supabase
          .from("invitations")
          .select("role, society_id, flat_id, name")
          .eq("user_id", userId)
          .eq("status", "pending")
          .single();

        if (inv) {
          // Auto-create profile from invitation
          const { data: newProfile } = await supabase
            .from("user_profiles")
            .insert({
              id: userId,
              name: inv.name ?? "New User",
              phone: "",
              role: inv.role,
              society_id: inv.society_id,
            })
            .select()
            .single();

          if (newProfile) {
            store.setProfile(newProfile);
            // Mark invitation accepted
            await supabase
              .from("invitations")
              .update({ status: "accepted" })
              .eq("user_id", userId);

            // Auto-link to flat if provided
            if (inv.flat_id) {
              await supabase.from("residents").insert({
                flat_id: inv.flat_id,
                user_id: userId,
                type: "owner",
                approved_at: new Date().toISOString(),
              });
            }
          }
        }
        // Profile stays null → user hits "no account" screen
      }
    } catch {
      // Supabase unreachable — profile stays null
    } finally {
      store.setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut().catch(() => {});
    store.signOut();
  }

  return { ...store, signOut: handleSignOut };
}
