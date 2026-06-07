import { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/utils";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
  reply_to_id: string | null;
  sender?: { name: string };
  reply_to?: { content: string; sender?: { name: string } };
}

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Group info
  const { data: group } = useQuery({
    queryKey: ["group-mobile", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id, name, member_count, purpose")
        .eq("id", groupId)
        .single();
      return data;
    },
    enabled: !!groupId,
  });

  // Messages
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["group-messages-mobile", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_messages")
        .select(`
          id, sender_id, content, is_deleted, created_at, reply_to_id,
          sender:sender_id(name),
          reply_to:reply_to_id(content, sender:sender_id(name))
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(100);
      return (data ?? []) as Message[];
    },
    enabled: !!groupId,
  });

  // Realtime
  useEffect(() => {
    if (!groupId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel(`group-chat-mobile-${groupId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      }, async (payload: { new: Message }) => {
        const { data: full } = await supabase
          .from("group_messages")
          .select("id, sender_id, content, is_deleted, created_at, reply_to_id, sender:sender_id(name)")
          .eq("id", payload.new.id)
          .single();
        if (full) {
          queryClient.setQueryData<Message[]>(["group-messages-mobile", groupId], (prev) => [
            ...(prev ?? []),
            full as Message,
          ]);
        }
      })
      .subscribe();

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(channel);
    };
  }, [groupId, queryClient]);

  // Send
  const sendMutation = useMutation({
    mutationFn: async ({ content, replyId }: { content: string; replyId?: string }) => {
      const { error } = await supabase.from("group_messages").insert({
        group_id: groupId,
        sender_id: profile!.id,
        content: content.trim(),
        message_type: "text",
        reply_to_id: replyId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInput("");
      setReplyTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  const PURPOSE_EMOJI: Record<string, string> = {
    general: "💬", sports: "🏏", cultural: "🎭",
    welfare: "🤝", emergency: "🚨", parents: "👨‍👩‍👧", other: "📌",
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="bg-card border-b border-border px-4 pt-12 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-base">←</Text>
        </TouchableOpacity>
        <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
          <Text className="text-xl">{PURPOSE_EMOJI[group?.purpose ?? "general"] ?? "💬"}</Text>
        </View>
        <View className="flex-1 min-w-0">
          <Text className="font-bold text-sm" numberOfLines={1}>{group?.name ?? "Group"}</Text>
          <Text className="text-xs text-muted-foreground">{group?.member_count ?? 0} members</Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/resident/groups/${groupId}/manage`)}>
          <Text className="text-primary text-sm">Manage</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">{PURPOSE_EMOJI[group?.purpose ?? "general"]}</Text>
              <Text className="text-muted-foreground font-medium">No messages yet</Text>
              <Text className="text-sm text-muted-foreground">Say hello! 👋</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isMine = item.sender_id === profile?.id;
            const sender = item.sender as { name: string } | null;
            const prevMsg = messages?.[index - 1];
            const showName = !isMine && prevMsg?.sender_id !== item.sender_id;

            return (
              <TouchableOpacity
                onLongPress={() => setReplyTo(item)}
                activeOpacity={0.8}
              >
                <View className={`flex-row gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  {!isMine && (
                    <View className="w-8 items-end mt-auto">
                      {showName && (
                        <View className="w-7 h-7 rounded-full bg-primary/15 items-center justify-center">
                          <Text className="text-xs font-bold text-primary">
                            {sender?.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View className={`max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                    {showName && !isMine && (
                      <Text className="text-xs text-muted-foreground ml-1 mb-0.5">{sender?.name}</Text>
                    )}

                    {/* Reply preview */}
                    {item.reply_to_id && item.reply_to && (
                      <View className="border-l-2 border-primary px-2 py-1 mb-0.5 bg-muted/50 rounded-lg max-w-full">
                        <Text className="text-[10px] text-primary font-semibold" numberOfLines={1}>
                          {(item.reply_to as { sender?: { name: string } })?.sender?.name ?? "Unknown"}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {(item.reply_to as { content: string })?.content}
                        </Text>
                      </View>
                    )}

                    <View className={`rounded-2xl px-3.5 py-2.5 ${
                      isMine ? "bg-primary rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"
                    } ${item.is_deleted ? "opacity-60" : ""}`}>
                      <Text className={`text-sm leading-relaxed ${isMine ? "text-white" : "text-foreground"} ${item.is_deleted ? "italic" : ""}`}>
                        {item.content}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {formatRelative(item.created_at)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Reply bar */}
      {replyTo && (
        <View className="flex-row items-center gap-2 px-3 py-2 bg-muted/50 border-t border-border">
          <Text className="text-primary text-sm flex-1" numberOfLines={1}>
            ↩ {(replyTo.sender as { name: string })?.name}: {replyTo.content}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text className="text-muted-foreground text-base">✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View className="flex-row items-end gap-2 px-3 py-3 border-t border-border bg-card">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor="#94a3b8"
          multiline
          className="flex-1 bg-muted rounded-2xl px-4 py-2.5 text-sm text-foreground max-h-24"
        />
        <TouchableOpacity
          onPress={() => input.trim() && sendMutation.mutate({ content: input, replyId: replyTo?.id })}
          disabled={!input.trim() || sendMutation.isPending}
          className={`w-10 h-10 rounded-full items-center justify-center ${input.trim() ? "bg-primary" : "bg-muted"}`}
        >
          {sendMutation.isPending
            ? <ActivityIndicator size="small" color="white" />
            : <Text className={`font-bold text-base ${input.trim() ? "text-white" : "text-muted-foreground"}`}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
