import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatDate } from "@/lib/utils";

export default function AdminResidentsScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: residents, isLoading } = useQuery({
    queryKey: ["admin-mobile-residents", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("residents")
        .select(`
          id, type, approved_at, created_at,
          user_profiles:user_id (name, phone, avatar_url),
          flats:flat_id (number, towers (name))
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("residents")
        .update({ approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-mobile-residents"] }),
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const pending = residents?.filter((r) => !r.approved_at) ?? [];
  const approved = residents?.filter((r) => !!r.approved_at) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Residents</Text>
        <Text className="text-gray-500 text-sm">{pending.length} pending approval</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}

        {pending.length > 0 && (
          <>
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
              Pending Approval
            </Text>
            {pending.map((r) => {
              const user = r.user_profiles as { name: string; phone: string } | null;
              const flat = r.flats as { number: string; towers: { name: string } | null } | null;
              return (
                <View key={r.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
                  <View className="flex-row items-center gap-3 mb-3">
                    <View className="w-10 h-10 bg-amber-200 rounded-xl items-center justify-center">
                      <Text className="font-bold text-amber-800">
                        {user?.name ? getInitials(user.name) : "?"}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-800">{user?.name}</Text>
                      <Text className="text-gray-500 text-sm">{user?.phone}</Text>
                      <Text className="text-gray-400 text-xs">
                        {flat?.towers?.name} – Flat {flat?.number} • {r.type}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => approveMutation.mutate(r.id)}
                    disabled={approveMutation.isPending}
                    className="bg-primary-500 rounded-xl py-2.5 items-center"
                  >
                    <Text className="text-white font-bold">Approve Resident</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {approved.length > 0 && (
          <>
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3 mt-2">
              Approved Residents ({approved.length})
            </Text>
            {approved.map((r) => {
              const user = r.user_profiles as { name: string; phone: string } | null;
              const flat = r.flats as { number: string; towers: { name: string } | null } | null;
              return (
                <View key={r.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center">
                      <Text className="font-bold text-green-700">
                        {user?.name ? getInitials(user.name) : "?"}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-800">{user?.name}</Text>
                      <Text className="text-gray-500 text-sm">{user?.phone}</Text>
                      <Text className="text-gray-400 text-xs">
                        {flat?.towers?.name} – Flat {flat?.number} • {r.type}
                      </Text>
                    </View>
                    <View className="bg-green-100 rounded-full px-2.5 py-1">
                      <Text className="text-green-700 text-xs font-bold">✓ Active</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
