import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  admin: "#7c3aed", resident: "#0284c7",
  guard: "#d97706", staff: "#059669", super_admin: "#dc2626",
};

export default function MemberDirectoryScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: members, isLoading } = useQuery({
    queryKey: ["member-directory-mobile", profile?.society_id],
    queryFn: async () => {
      if (!profile?.society_id) return [];
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, flat_number, avatar_url")
        .eq("society_id", profile.society_id)
        .order("name");
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const filtered = members?.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.flat_number?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q)
    );
  });

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card border-b border-border px-4 pt-12 pb-3">
        <Text className="text-xl font-bold mb-3">Members</Text>
        <View className="flex-row items-center bg-muted rounded-xl px-3 py-2 gap-2">
          <Text className="text-muted-foreground text-base">🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, flat or role…"
            placeholderTextColor="#94a3b8"
            className="flex-1 text-sm text-foreground"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          ListEmptyComponent={
            <View className="col-span-2 items-center py-20">
              <Text className="text-muted-foreground">No members found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelf = item.id === profile?.id;
            const color = ROLE_COLORS[item.role] ?? "#94a3b8";
            return (
              <TouchableOpacity
                className="flex-1 bg-card rounded-2xl p-4 border border-border items-center gap-2"
                onPress={() => router.push(`/resident/members/${item.id}`)}
              >
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color, fontSize: 20, fontWeight: "700" }}>
                    {getInitials(item.name ?? "?")}
                  </Text>
                </View>
                <Text className="font-semibold text-sm text-center" numberOfLines={1}>{item.name}</Text>
                {item.flat_number && (
                  <Text className="text-xs text-muted-foreground">Flat {item.flat_number}</Text>
                )}
                <View style={{ backgroundColor: color + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ color, fontSize: 10, fontWeight: "700", textTransform: "capitalize" }}>
                    {item.role?.replace("_", " ")}{isSelf ? " (You)" : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
