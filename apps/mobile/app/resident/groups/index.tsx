import { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const PURPOSE_EMOJI: Record<string, string> = {
  general: "💬", sports: "🏏", cultural: "🎭",
  welfare: "🤝", emergency: "🚨", parents: "👨‍👩‍👧", other: "📌",
};

const TYPE_OPTIONS = [
  { value: "open",            label: "Open",            emoji: "🌐" },
  { value: "request_to_join", label: "Request to Join", emoji: "✋" },
  { value: "invite_only",     label: "Invite Only",     emoji: "🔒" },
];

const PURPOSE_OPTIONS = [
  { value: "general",   label: "General",   emoji: "💬" },
  { value: "sports",    label: "Sports",    emoji: "🏏" },
  { value: "cultural",  label: "Cultural",  emoji: "🎭" },
  { value: "welfare",   label: "Welfare",   emoji: "🤝" },
  { value: "emergency", label: "Emergency", emoji: "🚨" },
  { value: "parents",   label: "Parents",   emoji: "👨‍👩‍👧" },
  { value: "other",     label: "Other",     emoji: "📌" },
];

export default function GroupsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"mine" | "discover">("mine");
  const [createModal, setCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [purpose, setPurpose] = useState("general");
  const [joinType, setJoinType] = useState("invite_only");

  // My groups
  const { data: myGroups, isLoading } = useQuery({
    queryKey: ["my-groups-mobile", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("group_members")
        .select("role, groups:group_id(id,name,description,purpose,type,member_count,created_at)")
        .eq("user_id", profile.id)
        .order("joined_at", { ascending: false });
      return (data ?? []).map((d) => ({ ...(d.groups as object), my_role: d.role }));
    },
    enabled: !!profile?.id,
  });

  // Discover
  const { data: discoverGroups } = useQuery({
    queryKey: ["discover-groups-mobile", profile?.society_id, profile?.id],
    queryFn: async () => {
      if (!profile?.society_id) return [];
      const { data: memberOf } = await supabase
        .from("group_members").select("group_id").eq("user_id", profile.id);
      const ids = (memberOf ?? []).map((m) => m.group_id);
      let q = supabase
        .from("groups")
        .select("id,name,description,purpose,type,member_count")
        .eq("society_id", profile.society_id)
        .in("type", ["open", "request_to_join"])
        .eq("is_archived", false);
      if (ids.length) q = q.not("id", "in", `(${ids.map((i) => `'${i}'`).join(",")})`);
      const { data } = await q.order("member_count", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.society_id && !!profile?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .insert({
          society_id: profile!.society_id,
          name: groupName.trim(),
          description: groupDesc.trim() || null,
          purpose,
          type: joinType,
          created_by: profile!.id,
        })
        .select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-groups-mobile"] });
      setCreateModal(false);
      setGroupName(""); setGroupDesc("");
      router.push(`/resident/groups/${data.id}`);
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const joinMutation = useMutation({
    mutationFn: async ({ groupId, type }: { groupId: string; type: string }) => {
      if (type === "open") {
        await supabase.from("group_members").insert({ group_id: groupId, user_id: profile!.id, role: "member" });
      } else {
        await supabase.from("group_join_requests").insert({ group_id: groupId, user_id: profile!.id });
      }
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: ["my-groups-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["discover-groups-mobile"] });
      Alert.alert("Done", type === "open" ? "You joined the group!" : "Join request sent!");
    },
  });

  const list = tab === "mine" ? myGroups : discoverGroups;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card border-b border-border px-4 pt-12 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold">Groups</Text>
          <TouchableOpacity
            onPress={() => setCreateModal(true)}
            className="flex-row items-center gap-1 bg-primary px-3 py-1.5 rounded-lg"
          >
            <Text className="text-white font-semibold text-sm">+ New Group</Text>
          </TouchableOpacity>
        </View>
        {/* Tabs */}
        <View className="flex-row gap-2">
          {(["mine", "discover"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? "bg-primary" : "bg-muted"}`}
            >
              <Text className={`text-sm font-semibold ${tab === t ? "text-white" : "text-muted-foreground"}`}>
                {t === "mine" ? "My Groups" : "Discover"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={list as any[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">
                {tab === "mine" ? "💬" : "🔍"}
              </Text>
              <Text className="text-muted-foreground font-medium">
                {tab === "mine" ? "No groups yet" : "No groups to discover"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-card rounded-2xl p-4 border border-border flex-row items-center gap-3"
              onPress={() => {
                if (tab === "mine") router.push(`/resident/groups/${item.id}`);
              }}
            >
              <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
                <Text className="text-2xl">{PURPOSE_EMOJI[item.purpose] ?? "💬"}</Text>
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2">
                  <Text className="font-semibold text-sm" numberOfLines={1}>{item.name}</Text>
                  {item.my_role === "admin" && (
                    <View className="bg-primary/10 px-1.5 py-0.5 rounded">
                      <Text className="text-primary text-[10px] font-bold">ADMIN</Text>
                    </View>
                  )}
                </View>
                {item.description ? (
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text className="text-xs text-muted-foreground mt-1">
                  {item.member_count} member{item.member_count !== 1 ? "s" : ""}
                  {" · "}
                  {item.type === "open" ? "🌐 Open" : item.type === "invite_only" ? "🔒 Invite only" : "✋ Request to join"}
                </Text>
              </View>
              {tab === "discover" && (
                <TouchableOpacity
                  onPress={() => joinMutation.mutate({ groupId: item.id, type: item.type })}
                  className={`px-3 py-1.5 rounded-lg ${item.type === "open" ? "bg-primary" : "border border-primary"}`}
                >
                  <Text className={`text-xs font-semibold ${item.type === "open" ? "text-white" : "text-primary"}`}>
                    {item.type === "open" ? "Join" : "Request"}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={createModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
            <TouchableOpacity onPress={() => setCreateModal(false)}>
              <Text className="text-primary">Cancel</Text>
            </TouchableOpacity>
            <Text className="font-bold text-base">New Group</Text>
            <TouchableOpacity
              onPress={() => groupName.length >= 2 && createMutation.mutate()}
              disabled={groupName.length < 2 || createMutation.isPending}
            >
              <Text className={`font-bold ${groupName.length >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4 space-y-5">
            <View className="space-y-2">
              <Text className="text-sm font-semibold">Group Name *</Text>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="e.g. Tower A Sports Club"
                placeholderTextColor="#94a3b8"
                className="bg-muted rounded-xl px-4 py-3 text-foreground text-sm"
                maxLength={80}
              />
            </View>

            <View className="space-y-2">
              <Text className="text-sm font-semibold">Description</Text>
              <TextInput
                value={groupDesc}
                onChangeText={setGroupDesc}
                placeholder="What is this group about?"
                placeholderTextColor="#94a3b8"
                className="bg-muted rounded-xl px-4 py-3 text-foreground text-sm"
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

            <View className="space-y-2">
              <Text className="text-sm font-semibold">Purpose</Text>
              <View className="flex-row flex-wrap gap-2">
                {PURPOSE_OPTIONS.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => setPurpose(p.value)}
                    className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                      purpose === p.value ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <Text>{p.emoji}</Text>
                    <Text className={`text-xs font-medium ${purpose === p.value ? "text-primary" : "text-foreground"}`}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="space-y-2">
              <Text className="text-sm font-semibold">Who can join?</Text>
              {TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setJoinType(t.value)}
                  className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                    joinType === t.value ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <Text className="text-xl">{t.emoji}</Text>
                  <Text className={`font-semibold text-sm ${joinType === t.value ? "text-primary" : "text-foreground"}`}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
