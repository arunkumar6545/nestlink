import { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatRelative } from "@/lib/utils";

interface DMessage {
  id: string;
  sender_id: string;
  content: string;
  is_deleted: boolean;
  is_read: boolean;
  created_at: string;
  reply_to_id: string | null;
  sender?: { name: string };
  reply_to?: { content: string; sender?: { name: string } };
}

export default function DirectChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<DMessage | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Conversation info
  const { data: conversation } = useQuery({
    queryKey: ["conv-mobile", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, participant1:participant1_id(id, name, flat_number), participant2:participant2_id(id, name, flat_number)")
        .eq("id", conversationId)
        .single();
      return data;
    },
    enabled: !!conversationId,
  });

  const other = conversation
    ? (conversation.participant1 as { id: string; name: string }).id === profile?.id
      ? conversation.participant2 as { id: string; name: string; flat_number: string }
      : conversation.participant1 as { id: string; name: string; flat_number: string }
    : null;

  // Messages
  const { data: messages, isLoading } = useQuery<DMessage[]>({
    queryKey: ["dm-mobile", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("id, sender_id, content, is_deleted, is_read, created_at, reply_to_id, sender:sender_id(name), reply_to:reply_to_id(content, sender:sender_id(name))")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);
      return (data ?? []) as DMessage[];
    },
    enabled: !!conversationId,
  });

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const channel = (supabase as any)
      .channel(`dm-mobile-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "direct_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload: { new: DMessage }) => {
        const { data: full } = await supabase
          .from("direct_messages")
          .select("id, sender_id, content, is_deleted, is_read, created_at, reply_to_id, sender:sender_id(name)")
          .eq("id", payload.new.id)
          .single();
        if (full) {
          queryClient.setQueryData<DMessage[]>(["dm-mobile", conversationId], (prev) => [...(prev ?? []), full as DMessage]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [conversationId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async ({ content, replyId }: { content: string; replyId?: string }) => {
      const { error } = await supabase.from("direct_messages").insert({
        conversation_id: conversationId, sender_id: profile!.id,
        content: content.trim(), message_type: "text", reply_to_id: replyId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInput(""); setReplyTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card border-b border-border px-4 pt-12 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-base">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-bold text-sm">{other?.name ?? "…"}</Text>
          {other?.flat_number && <Text className="text-xs text-muted-foreground">Flat {other.flat_number}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/resident/members/${other?.id}`)}
          className="p-2"
        >
          <Text className="text-primary text-sm">Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View className="items-center py-20 gap-3">
              <Text className="text-4xl">👋</Text>
              <Text className="text-muted-foreground font-medium">Say hello to {other?.name}!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.sender_id === profile?.id;
            const reply = item.reply_to as { content: string; sender?: { name: string } } | null;

            return (
              <TouchableOpacity onLongPress={() => setReplyTo(item)} activeOpacity={0.8}>
                <View className={`flex-row gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  {!isMine && (
                    <View className="w-7 h-7 rounded-full bg-primary/15 items-center justify-center mt-auto">
                      <Text className="text-xs font-bold text-primary">
                        {getInitials((item.sender as { name: string })?.name ?? "?")}
                      </Text>
                    </View>
                  )}
                  <View className={`max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                    {reply && (
                      <View className="border-l-2 border-primary px-2 py-1 mb-1 bg-muted/50 rounded-lg">
                        <Text className="text-[10px] text-primary font-semibold" numberOfLines={1}>
                          {reply.sender?.name ?? "Unknown"}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>{reply.content}</Text>
                      </View>
                    )}
                    <View className={`rounded-2xl px-3.5 py-2.5 ${isMine ? "bg-primary rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"}`}>
                      <Text className={`text-sm leading-relaxed ${isMine ? "text-white" : "text-foreground"}`}>
                        {item.content}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {formatRelative(item.created_at)}
                      {isMine && <Text> {item.is_read ? "✓✓" : "✓"}</Text>}
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
            <Text className="text-muted-foreground">✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View className="flex-row items-end gap-2 px-3 py-3 border-t border-border bg-card">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message…"
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
            : <Text className={input.trim() ? "text-white font-bold text-base" : "text-muted-foreground text-base"}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
