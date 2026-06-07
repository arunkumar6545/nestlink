import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatRelative } from "@/lib/utils";

export default function MemberProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isSelf = userId === profile?.id;
  const [newPost, setNewPost] = useState("");

  const { data: member } = useQuery({
    queryKey: ["member-profile-mobile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, flat_number, avatar_url, created_at")
        .eq("id", userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["member-posts-mobile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_posts")
        .select("id, content, likes_count, comments_count, created_at, my_like:post_likes(user_id)")
        .eq("author_id", userId)
        .order("created_at", { ascending: false });
      return (data ?? []).map((p) => ({
        ...p,
        liked: (p.my_like as { user_id: string }[])?.some((l) => l.user_id === profile?.id) ?? false,
      }));
    },
    enabled: !!userId && !!profile?.id,
  });

  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("member_posts").insert({
        society_id: profile!.society_id, author_id: profile!.id, content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-posts-mobile", userId] });
      setNewPost("");
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const likeMutation = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (liked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", profile!.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: profile!.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["member-posts-mobile", userId] }),
  });

  async function openDM() {
    const { data: convId } = await supabase.rpc("get_or_create_conversation", { other_user_id: userId });
    if (convId) router.push(`/resident/messages/${convId}`);
  }

  if (!member) return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card border-b border-border px-4 pt-12 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-primary">← Back</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-4">
          <View className="w-20 h-20 rounded-2xl bg-primary/15 items-center justify-center">
            <Text className="text-2xl font-bold text-primary">{getInitials(member.name ?? "?")}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold">{member.name}</Text>
            <Text className="text-sm text-muted-foreground capitalize mt-0.5">
              {member.role?.replace("_", " ")}
            </Text>
            {member.flat_number && (
              <Text className="text-sm text-muted-foreground">Flat {member.flat_number}</Text>
            )}
            <Text className="text-xs text-muted-foreground mt-1">
              Member since {new Date(member.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        {!isSelf && (
          <View className="flex-row gap-2 mt-4">
            <TouchableOpacity onPress={openDM} className="flex-1 bg-primary py-2.5 rounded-xl items-center flex-row justify-center gap-1.5">
              <Text className="text-white text-xl">💬</Text>
              <Text className="text-white font-semibold text-sm">Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${member.phone}`)}
              className="flex-1 border border-border py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
            >
              <Text className="text-xl">📞</Text>
              <Text className="font-semibold text-sm">Call</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Posts */}
      <View className="p-4 space-y-4">
        <Text className="font-bold text-base">Posts</Text>

        {isSelf && (
          <View className="bg-card rounded-2xl border border-border p-3 gap-2">
            <TextInput
              value={newPost}
              onChangeText={setNewPost}
              placeholder="Share something with your society…"
              placeholderTextColor="#94a3b8"
              multiline
              className="text-sm text-foreground min-h-[60px]"
              maxLength={2000}
            />
            <TouchableOpacity
              onPress={() => newPost.trim() && postMutation.mutate(newPost)}
              disabled={!newPost.trim() || postMutation.isPending}
              className={`self-end px-4 py-2 rounded-xl ${newPost.trim() ? "bg-primary" : "bg-muted"}`}
            >
              <Text className={newPost.trim() ? "text-white font-semibold text-sm" : "text-muted-foreground text-sm"}>
                {postMutation.isPending ? "Posting…" : "Post"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {postsLoading && <ActivityIndicator />}

        {!postsLoading && posts?.length === 0 && (
          <Text className="text-muted-foreground text-sm text-center py-8">No posts yet</Text>
        )}

        {posts?.map((post) => (
          <View key={post.id} className="bg-card rounded-2xl border border-border p-4 gap-3">
            <Text className="text-sm leading-relaxed">{post.content}</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">{formatRelative(post.created_at)}</Text>
              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() => likeMutation.mutate({ postId: post.id, liked: post.liked })}
                  className="flex-row items-center gap-1"
                >
                  <Text className="text-base">{post.liked ? "❤️" : "🤍"}</Text>
                  <Text className="text-xs text-muted-foreground">{post.likes_count}</Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-1">
                  <Text className="text-base">💬</Text>
                  <Text className="text-xs text-muted-foreground">{post.comments_count}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
