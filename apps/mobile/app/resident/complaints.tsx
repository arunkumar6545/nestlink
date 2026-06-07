import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { complaintCategories, formatRelative } from "@/lib/utils";

const statusColors: Record<string, string> = {
  open: "#ef4444",
  in_progress: "#f59e0b",
  resolved: "#22c55e",
  closed: "#94a3b8",
};

const priorityColors: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export default function ComplaintsScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: complaintCategories[0],
    priority: "medium",
  });

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["mobile-complaints", profile?.id],
    queryFn: async () => {
      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();
      if (!resident) return [];

      const { data } = await supabase
        .from("complaints")
        .select("*")
        .eq("flat_id", resident.flat_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.description) throw new Error("All fields required");

      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();
      if (!resident) throw new Error("Resident not found");

      const { error } = await supabase.from("complaints").insert({
        flat_id: resident.flat_id,
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority as "low" | "medium" | "high" | "critical",
        status: "open",
        photo_urls: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-complaints"] });
      setShowModal(false);
      setForm({ title: "", description: "", category: complaintCategories[0], priority: "medium" });
      Alert.alert("Success", "Complaint raised successfully");
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Complaints</Text>
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          className="bg-primary-500 rounded-xl px-4 py-2"
        >
          <Text className="text-white font-bold text-sm">+ Raise</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}
        {!isLoading && complaints?.length === 0 && (
          <View className="items-center mt-20">
            <Text className="text-4xl mb-3">✅</Text>
            <Text className="text-gray-400">No complaints raised</Text>
          </View>
        )}
        {complaints?.map((c) => (
          <View key={c.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <Text className="font-bold text-gray-800" numberOfLines={1}>{c.title}</Text>
                <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={2}>{c.description}</Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {c.category} • {formatRelative(c.created_at)}
                </Text>
              </View>
              <View className="items-end gap-1">
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: `${statusColors[c.status] ?? "#64748b"}20` }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: statusColors[c.status] ?? "#64748b" }}
                  >
                    {c.status.replace("_", " ")}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: `${priorityColors[c.priority] ?? "#64748b"}20` }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: priorityColors[c.priority] ?? "#64748b" }}
                  >
                    {c.priority}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
        <View className="h-6" />
      </ScrollView>

      {/* Create Complaint Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-gray-500">Cancel</Text>
            </TouchableOpacity>
            <Text className="font-bold text-gray-800">Raise Complaint</Text>
            <View className="w-12" />
          </View>

          <ScrollView className="flex-1 px-5 py-6">
            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-1.5">Title</Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3.5 text-gray-800"
                placeholder="Brief description of issue"
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              />
            </View>
            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-1.5">Description</Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3.5 text-gray-800"
                placeholder="Describe the issue in detail..."
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: "top" }}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              />
            </View>
            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-1.5">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {complaintCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setForm((f) => ({ ...f, category: cat }))}
                      className={`px-4 py-2 rounded-full border ${form.category === cat ? "bg-primary-500 border-primary-500" : "bg-white border-gray-200"}`}
                    >
                      <Text className={`text-sm font-medium ${form.category === cat ? "text-white" : "text-gray-600"}`}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-1.5">Priority</Text>
              <View className="flex-row gap-2">
                {["low", "medium", "high", "critical"].map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setForm((f) => ({ ...f, priority: p }))}
                    className={`flex-1 py-2.5 rounded-xl border ${form.priority === p ? "bg-primary-500 border-primary-500" : "bg-white border-gray-200"}`}
                  >
                    <Text className={`text-xs text-center font-medium capitalize ${form.priority === p ? "text-white" : "text-gray-600"}`}>
                      {p}
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
                <Text className="text-white font-bold text-base">Submit Complaint</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
