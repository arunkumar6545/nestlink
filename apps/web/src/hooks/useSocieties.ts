import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSocietyStore, type Society } from "@/store/society";
import { useAuth } from "./useAuth";

/**
 * Fetches all societies the authenticated user belongs to,
 * populates the society store, and returns the active one.
 */
export function useSocieties() {
  const { profile } = useAuth();
  const { setSocieties, activeSocietyId, setActiveSociety, activeSociety, societies } =
    useSocietyStore();

  const { data, isLoading } = useQuery<Society[]>({
    queryKey: ["user-societies", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Admins: societies where they are the admin
      // Residents/Guards: society from their profile's society_id
      if (profile.role === "admin") {
        const { data } = await supabase
          .from("societies")
          .select("id, name, address, city, logo_url, plan")
          .eq("admin_id", profile.id)
          .order("name");
        return (data ?? []) as Society[];
      }

      // For residents/guards: fetch the single society from their profile
      if (profile.society_id) {
        const { data } = await supabase
          .from("societies")
          .select("id, name, address, city, logo_url, plan")
          .eq("id", profile.society_id);
        return (data ?? []) as Society[];
      }

      return [];
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (data) setSocieties(data);
  }, [data, setSocieties]);

  return {
    societies,
    activeSocietyId,
    activeSociety: activeSociety(),
    setActiveSociety,
    isLoading,
  };
}
