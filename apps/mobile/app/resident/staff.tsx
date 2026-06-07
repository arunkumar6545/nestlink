import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";

const categoryEmojis: Record<string, string> = {
  maid: "🧹",
  cook: "👨‍🍳",
  driver: "🚗",
  gardener: "🌱",
  watchman: "💂",
  other: "👤",
};

export default function StaffScreen() {
  const { profile } = useAuth();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["mobile-staff", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("domestic_staff")
        .select("*")
        .eq("society_id", profile!.society_id!)
        .order("name");
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Domestic Staff</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}
        {!isLoading && staff?.length === 0 && (
          <View className="items-center mt-20">
            <Text className="text-4xl mb-3">👨‍🍳</Text>
            <Text className="text-gray-400">No staff members added yet</Text>
          </View>
        )}
        {staff?.map((s) => (
          <View key={s.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 bg-gray-100 rounded-xl items-center justify-center">
                <Text className="text-xl">{categoryEmojis[s.category] ?? "👤"}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="font-bold text-gray-800">{s.name}</Text>
                  {s.verified && <Text className="text-green-500 text-xs">✓ Verified</Text>}
                </View>
                <Text className="text-gray-500 text-sm capitalize">{s.category}</Text>
                <Text className="text-gray-400 text-xs">{s.phone}</Text>
              </View>
            </View>
          </View>
        ))}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
