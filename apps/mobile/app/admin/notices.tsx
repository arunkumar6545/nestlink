import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative } from "@/lib/utils";

export default function AdminNoticesScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", type: "info" as "info" | "urgent" | "event", pinned: false });

  const { data: notices, isLoading } = useQuery({
    queryKey: ["admin-mobile-notices", profile?.society_id],
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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.body) throw new Error("Title and message required");
      const { error } = await supabase.from("notices").insert({
        ...form,
        society_id: profile!.society_id!,
        created_by: profile!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-mobile-notices"] });
      setShowModal(false);
      setForm({ title: "", body: "", type: "info", pinned: false });
      Alert.alert("Success", "Notice sent to all residents");
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const typeColors: Record<string, string> = { urgent: "#ef4444", info: "#0ea5e9", event: "#8b5cf6" };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Notices</Text>
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          className="bg-primary-500 rounded-xl px-4 py-2"
        >
          <Text className="text-white font-bold text-sm">+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}
        {notices?.map((n) => (
          <View key={n.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-start justify-between mb-1">
              <Text className="font-bold text-gray-800 flex-1 mr-2">
                {n.pinned ? "📌 " : ""}{n.title}
              </Text>
              <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${typeColors[n.type]}20` }}>
                <Text className="text-xs font-bold capitalize" style={{ color: typeColors[n.type] }}>
                  {n.type}
                </Text>
              </View>
            </View>
            <Text className="text-gray-500 text-sm" numberOfLines={2}>{n.body}</Text>
            <Text className="text-gray-400 text-xs mt-2">{formatRelative(n.created_at)}</Text>
          </View>
        ))}
        <View className="h-6" />
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-gray-500">Cancel</Text>
            </TouchableOpacity>
            <Text className="font-bold text-gray-800">New Notice</Text>
            <View className="w-12" />
          </View>
          <ScrollView className="flex-1 px-5 py-6">
            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-1.5">Title</Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3.5 text-gray-800"
                placeholder="Notice title..."
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              />
            </View>
            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-1.5">Message</Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3.5 text-gray-800"
                placeholder="Write your announcement..."
                multiline
                numberOfLines={5}
                style={{ height: 120, textAlignVertical: "top" }}
                value={form.body}
                onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
              />
            </View>
            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-1.5">Type</Text>
              <View className="flex-row gap-2">
                {(["info", "urgent", "event"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-3 rounded-xl border items-center ${form.type === t ? "bg-primary-500 border-primary-500" : "bg-white border-gray-200"}`}
                  >
                    <Text className={`text-sm font-medium capitalize ${form.type === t ? "text-white" : "text-gray-600"}`}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-primary-500 rounded-xl py-4 items-center"
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">📢 Send to All Residents</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
