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
import { generateOtp, generateQrToken, formatDateTime } from "@/lib/utils";

export default function VisitorsScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [createdOtp, setCreatedOtp] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", purpose: "" });

  const { data: passes, isLoading } = useQuery({
    queryKey: ["mobile-visitor-passes", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitor_passes")
        .select(`
          id, otp, status, valid_from, valid_until,
          visitors:visitor_id (name, phone, purpose)
        `)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.phone || !form.purpose) {
        throw new Error("All fields are required");
      }

      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) throw new Error("Resident not found");

      const { data: visitor, error: vErr } = await supabase
        .from("visitors")
        .insert({
          society_id: profile!.society_id!,
          name: form.name,
          phone: form.phone.startsWith("+") ? form.phone : `+91${form.phone}`,
          purpose: form.purpose,
        })
        .select()
        .single();

      if (vErr || !visitor) throw vErr ?? new Error("Failed to create visitor");

      const otp = generateOtp();
      const qr_token = generateQrToken();

      const { error: pErr } = await supabase.from("visitor_passes").insert({
        visitor_id: visitor.id,
        flat_id: resident.flat_id,
        qr_token,
        otp,
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        status: "active",
      });

      if (pErr) throw pErr;
      return otp;
    },
    onSuccess: (otp) => {
      queryClient.invalidateQueries({ queryKey: ["mobile-visitor-passes"] });
      setCreatedOtp(otp);
      setForm({ name: "", phone: "", purpose: "" });
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const statusColors: Record<string, string> = {
    active: "#22c55e",
    used: "#94a3b8",
    expired: "#94a3b8",
    cancelled: "#ef4444",
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Visitors</Text>
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          className="bg-primary-500 rounded-xl px-4 py-2"
        >
          <Text className="text-white font-bold text-sm">+ Invite</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}
        {!isLoading && passes?.length === 0 && (
          <View className="items-center mt-20">
            <Text className="text-4xl mb-3">🔑</Text>
            <Text className="text-gray-400">No visitor passes yet</Text>
          </View>
        )}
        {passes?.map((p) => {
          const visitor = p.visitors as { name: string; phone: string; purpose: string } | null;
          return (
            <View key={p.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="font-bold text-gray-800">{visitor?.name}</Text>
                  <Text className="text-gray-500 text-sm mt-0.5">{visitor?.purpose}</Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {formatDateTime(p.valid_from)} – {formatDateTime(p.valid_until)}
                  </Text>
                </View>
                <View>
                  <View
                    className="rounded-full px-3 py-1"
                    style={{ backgroundColor: `${statusColors[p.status]}20` }}
                  >
                    <Text
                      className="text-xs font-bold capitalize"
                      style={{ color: statusColors[p.status] }}
                    >
                      {p.status}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-400 mt-2 text-right font-mono">
                    {p.otp}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
        <View className="h-6" />
      </ScrollView>

      {/* Create Visitor Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
            <TouchableOpacity onPress={() => { setShowModal(false); setCreatedOtp(null); }}>
              <Text className="text-gray-500">Cancel</Text>
            </TouchableOpacity>
            <Text className="font-bold text-gray-800">
              {createdOtp ? "Pass Created!" : "Invite Visitor"}
            </Text>
            <View className="w-12" />
          </View>

          <ScrollView className="flex-1 px-5 py-6">
            {createdOtp ? (
              <View className="items-center">
                <View className="w-20 h-20 bg-green-100 rounded-2xl items-center justify-center mb-4">
                  <Text className="text-4xl">✅</Text>
                </View>
                <Text className="text-lg font-bold text-gray-800 mb-1">Pass Generated</Text>
                <Text className="text-gray-500 text-sm mb-8 text-center">
                  Share this OTP with your visitor
                </Text>
                <View className="bg-gray-100 rounded-2xl px-10 py-6 mb-6">
                  <Text className="text-5xl font-bold text-primary-500 tracking-widest text-center">
                    {createdOtp}
                  </Text>
                  <Text className="text-gray-400 text-xs text-center mt-2">6-digit OTP</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setShowModal(false); setCreatedOtp(null); }}
                  className="bg-primary-500 rounded-xl py-4 w-full items-center"
                >
                  <Text className="text-white font-bold">Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-1.5">Visitor Name</Text>
                  <TextInput
                    className="bg-gray-100 rounded-xl px-4 py-3.5 text-gray-800"
                    placeholder="John Doe"
                    value={form.name}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  />
                </View>
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-1.5">Phone Number</Text>
                  <TextInput
                    className="bg-gray-100 rounded-xl px-4 py-3.5 text-gray-800"
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    value={form.phone}
                    onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                  />
                </View>
                <View className="mb-6">
                  <Text className="text-gray-700 font-medium mb-1.5">Purpose of Visit</Text>
                  <TextInput
                    className="bg-gray-100 rounded-xl px-4 py-3.5 text-gray-800"
                    placeholder="Meeting, Delivery, etc."
                    value={form.purpose}
                    onChangeText={(v) => setForm((f) => ({ ...f, purpose: v }))}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="bg-primary-500 rounded-xl py-4 items-center"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-base">Generate Pass</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
