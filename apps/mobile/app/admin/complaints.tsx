import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/utils";

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: "#fee2e2", text: "#991b1b" },
  in_progress: { bg: "#fef3c7", text: "#92400e" },
  resolved: { bg: "#dcfce7", text: "#166534" },
  closed: { bg: "#f1f5f9", text: "#64748b" },
};

export default function AdminComplaintsScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["admin-mobile-complaints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("complaints")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-mobile-complaints"] }),
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  function showStatusPicker(id: string, current: string) {
    Alert.alert("Update Status", "Select new status", [
      { text: "Open", onPress: () => updateMutation.mutate({ id, status: "open" }) },
      { text: "In Progress", onPress: () => updateMutation.mutate({ id, status: "in_progress" }) },
      { text: "Resolved", onPress: () => updateMutation.mutate({ id, status: "resolved" }) },
      { text: "Close", onPress: () => updateMutation.mutate({ id, status: "closed" }) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Complaints</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}
        {complaints?.map((c) => {
          const colors = statusColors[c.status] ?? statusColors.open;
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => showStatusPicker(c.id, c.status)}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <Text className="font-bold text-gray-800" numberOfLines={1}>{c.title}</Text>
                  <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={2}>{c.description}</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {c.category} • {formatRelative(c.created_at)}
                  </Text>
                </View>
                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: colors.bg }}
                >
                  <Text className="text-xs font-bold capitalize" style={{ color: colors.text }}>
                    {c.status.replace("_", " ")}
                  </Text>
                </View>
              </View>
              <Text className="text-primary-500 text-xs mt-2">Tap to update status →</Text>
            </TouchableOpacity>
          );
        })}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
