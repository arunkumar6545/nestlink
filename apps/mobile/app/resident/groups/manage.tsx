import { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@nestlink/core";

type Tab = "members" | "requests" | "invites";

export default function GroupManageScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("members");
  const [inviteModal, setInviteModal] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");

  // Members
  const { data: members, isLoading } = useQuery({
    queryKey: ["group-members-mobile-manage", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("role, joined_at, user:user_id(id, name, phone, role)")
        .eq("group_id", groupId)
        .order("role");
      return data ?? [];
    },
    enabled: !!groupId,
  });

  // Join requests
  const { data: requests } = useQuery({
    queryKey: ["join-requests-mobile", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_join_requests")
        .select("id, message, status, created_at, user:user_id(id, name, phone)")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at");
      return data ?? [];
    },
    enabled: !!groupId,
  });

  // Pending invites
  const { data: invites } = useQuery({
    queryKey: ["group-invites-mobile", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_invitations")
        .select("id, invitee_phone, status, created_at, invitee:invitee_id(name)")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!groupId,
  });

  const inviteMutation = useMutation({
    mutationFn: async (phone: string) => {
      const fmt = phone.startsWith("+") ? phone : `+91${phone}`;
      const { data: user } = await supabase.from("user_profiles").select("id").eq("phone", fmt).single();
      const { error } = await supabase.from("group_invitations").insert({
        group_id: groupId, invited_by: profile!.id,
        invitee_id: user?.id ?? null, invitee_phone: fmt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-invites-mobile"] });
      setInviteModal(false);
      setInvitePhone("");
      Alert.alert("Success", "Invitation sent!");
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({ reqId, userId, approve }: { reqId: string; userId: string; approve: boolean }) => {
      await supabase.from("group_join_requests").update({
        status: approve ? "approved" : "rejected",
        reviewed_by: profile!.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", reqId);
      if (approve) {
        await supabase.from("group_members").insert({ group_id: groupId, user_id: userId, role: "member" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests-mobile"] });
      queryClient.invalidateQueries({ queryKey: ["group-members-mobile-manage"] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group-members-mobile-manage"] }),
  });

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "members", label: "Members" },
    { key: "requests", label: "Requests", badge: requests?.length },
    { key: "invites", label: "Invites" },
  ];

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card border-b border-border px-4 pt-12 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary">← Back</Text>
          </TouchableOpacity>
          <Text className="font-bold text-base">Group Management</Text>
          <TouchableOpacity
            onPress={() => setInviteModal(true)}
            className="bg-primary px-3 py-1.5 rounded-lg"
          >
            <Text className="text-white font-semibold text-xs">+ Invite</Text>
          </TouchableOpacity>
        </View>
        {/* Tabs */}
        <View className="flex-row gap-2">
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg items-center flex-row justify-center gap-1 ${tab === t.key ? "bg-primary" : "bg-muted"}`}
            >
              <Text className={`text-xs font-semibold ${tab === t.key ? "text-white" : "text-muted-foreground"}`}>
                {t.label}
              </Text>
              {!!t.badge && t.badge > 0 && (
                <View className="bg-amber-500 rounded-full px-1.5">
                  <Text className="text-white text-[9px] font-bold">{t.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={
            tab === "members" ? members as any[] :
            tab === "requests" ? requests as any[] :
            invites as any[]
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Text className="text-muted-foreground">
                {tab === "members" ? "No members" : tab === "requests" ? "No pending requests" : "No pending invitations"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (tab === "members") {
              const u = item.user as { id: string; name: string; phone: string };
              const isSelf = u?.id === profile?.id;
              return (
                <View className="bg-card rounded-xl p-3.5 border border-border flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center">
                    <Text className="text-sm font-bold text-primary">{u?.name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-medium" numberOfLines={1}>{u?.name}</Text>
                      {item.role === "admin" && (
                        <Text className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded">ADMIN</Text>
                      )}
                      {isSelf && <Text className="text-[10px] text-muted-foreground">you</Text>}
                    </View>
                    <Text className="text-xs text-muted-foreground">{u?.phone}</Text>
                  </View>
                  {!isSelf && (
                    <TouchableOpacity
                      onPress={() => Alert.alert("Remove", `Remove ${u?.name} from group?`, [
                        { text: "Cancel" },
                        { text: "Remove", style: "destructive", onPress: () => removeMemberMutation.mutate(u.id) },
                      ])}
                      className="p-2"
                    >
                      <Text className="text-destructive text-xs">Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }

            if (tab === "requests") {
              const u = item.user as { id: string; name: string; phone: string };
              return (
                <View className="bg-card rounded-xl p-3.5 border border-border">
                  <View className="flex-row items-center gap-3">
                    <View className="w-9 h-9 rounded-full bg-amber-100 items-center justify-center">
                      <Text className="text-sm font-bold text-amber-700">{u?.name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium">{u?.name}</Text>
                      <Text className="text-xs text-muted-foreground">{u?.phone}</Text>
                      {item.message && <Text className="text-xs text-muted-foreground italic">"{item.message}"</Text>}
                    </View>
                  </View>
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      onPress={() => approveRequestMutation.mutate({ reqId: item.id, userId: u.id, approve: false })}
                      className="flex-1 py-2 border border-red-200 rounded-lg items-center"
                    >
                      <Text className="text-red-500 text-sm font-medium">Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => approveRequestMutation.mutate({ reqId: item.id, userId: u.id, approve: true })}
                      className="flex-1 py-2 bg-emerald-600 rounded-lg items-center"
                    >
                      <Text className="text-white text-sm font-medium">Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            // Invites
            const invitee = item.invitee as { name: string } | null;
            return (
              <View className="bg-card rounded-xl p-3.5 border border-border flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-sky-100 items-center justify-center">
                  <Text className="text-sky-600 text-base">📱</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium">{invitee?.name ?? "—"}</Text>
                  <Text className="text-xs text-muted-foreground">{item.invitee_phone}</Text>
                  <Text className="text-xs text-muted-foreground">{formatRelative(item.created_at)}</Text>
                </View>
                <View className="bg-amber-50 px-2 py-1 rounded-full">
                  <Text className="text-amber-600 text-xs font-semibold">Pending</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Invite Modal */}
      <Modal visible={inviteModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl p-6 gap-4">
            <Text className="text-lg font-bold text-center">Invite Member</Text>
            <Text className="text-sm text-muted-foreground text-center">
              Enter phone number of a society member
            </Text>
            <View className="flex-row gap-2">
              <View className="bg-muted rounded-xl px-3 py-3 justify-center">
                <Text className="text-muted-foreground text-sm">+91</Text>
              </View>
              <TextInput
                value={invitePhone}
                onChangeText={setInvitePhone}
                placeholder="9876543210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                className="flex-1 bg-muted rounded-xl px-4 py-3 text-sm text-foreground"
              />
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setInviteModal(false); setInvitePhone(""); }}
                className="flex-1 py-3 border border-border rounded-xl items-center"
              >
                <Text className="font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => invitePhone.length === 10 && inviteMutation.mutate(invitePhone)}
                disabled={invitePhone.length < 10 || inviteMutation.isPending}
                className={`flex-1 py-3 rounded-xl items-center ${invitePhone.length >= 10 ? "bg-primary" : "bg-muted"}`}
              >
                {inviteMutation.isPending
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text className={`font-semibold ${invitePhone.length >= 10 ? "text-white" : "text-muted-foreground"}`}>
                      Send Invite
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
