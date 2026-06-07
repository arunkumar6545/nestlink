import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/utils";

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  urgent: { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  info: { bg: "#e0f2fe", text: "#075985", border: "#bae6fd" },
  event: { bg: "#f3e8ff", text: "#6b21a8", border: "#e9d5ff" },
};

export default function NoticesScreen() {
  const { profile } = useAuth();

  const { data: notices, isLoading } = useQuery({
    queryKey: ["mobile-notices-full", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("*")
        .eq("society_id", profile!.society_id!)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Notices</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}
        {!isLoading && notices?.length === 0 && (
          <View className="items-center mt-20">
            <Text className="text-4xl mb-3">📢</Text>
            <Text className="text-gray-400">No notices yet</Text>
          </View>
        )}
        {notices?.map((notice) => {
          const colors = typeColors[notice.type] ?? typeColors.info;
          return (
            <View
              key={notice.id}
              className="rounded-2xl p-4 mb-3 shadow-sm"
              style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-start justify-between mb-2">
                <Text className="font-bold flex-1 mr-2" style={{ color: colors.text }}>
                  {notice.pinned ? "📌 " : ""}{notice.title}
                </Text>
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: "white" }}
                >
                  <Text className="text-xs font-semibold capitalize" style={{ color: colors.text }}>
                    {notice.type}
                  </Text>
                </View>
              </View>
              <Text className="text-sm leading-5" style={{ color: colors.text }}>
                {notice.body}
              </Text>
              <Text className="text-xs mt-2 opacity-70" style={{ color: colors.text }}>
                {formatRelative(notice.created_at)}
              </Text>
            </View>
          );
        })}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
