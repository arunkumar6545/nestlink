import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatRelative } from "@/lib/utils";

export default function MessagesScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations-mobile", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("conversations")
        .select(`
          id, last_message_at, last_message_preview,
          participant1:participant1_id(id, name, avatar_url, flat_number),
          participant2:participant2_id(id, name, avatar_url, flat_number)
        `)
        .or(`participant1_id.eq.${profile.id},participant2_id.eq.${profile.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
    refetchInterval: 5000,
  });

  function otherParticipant(conv: any) {
    const p1 = conv.participant1 as { id: string; name: string; flat_number: string };
    const p2 = conv.participant2 as { id: string; name: string; flat_number: string };
    return p1?.id === profile?.id ? p2 : p1;
  }

  const filtered = conversations?.filter((c) => {
    const other = otherParticipant(c);
    return other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View className="flex-1 bg-background">
      <View className="bg-card border-b border-border px-4 pt-12 pb-3">
        <Text className="text-xl font-bold mb-3">Messages</Text>
        <View className="flex-row items-center bg-muted rounded-xl px-3 py-2 gap-2">
          <Text className="text-muted-foreground">🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations…"
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
          ListEmptyComponent={
            <View className="items-center py-20 gap-3">
              <Text className="text-4xl">💬</Text>
              <Text className="text-muted-foreground font-medium">No conversations yet</Text>
              <Text className="text-sm text-muted-foreground text-center px-8">
                Visit a member's profile to start chatting
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const other = otherParticipant(item);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/resident/messages/${item.id}`)}
                className="flex-row items-center gap-3 px-4 py-3.5 border-b border-border/50"
              >
                <View className="w-11 h-11 rounded-full bg-primary/15 items-center justify-center shrink-0">
                  <Text className="text-sm font-bold text-primary">{getInitials(other?.name ?? "?")}</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold text-sm" numberOfLines={1}>{other?.name ?? "Unknown"}</Text>
                    {item.last_message_at && (
                      <Text className="text-xs text-muted-foreground ml-2 shrink-0">
                        {formatRelative(item.last_message_at)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                    {item.last_message_preview ?? "Start a conversation"}
                  </Text>
                  {other?.flat_number && (
                    <Text className="text-xs text-muted-foreground/70 mt-0.5">Flat {other.flat_number}</Text>
                  )}
                </View>
                <Text className="text-muted-foreground text-lg">›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
