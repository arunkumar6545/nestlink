import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@nestlink/core";

interface ScanResult {
  visitor_name: string;
  flat: string;
  purpose: string;
  valid_until: string;
}

export default function GuardScreen() {
  const { profile, signOut } = useAuth();
  const [otp, setOtp] = useState("");
  const [action, setAction] = useState<"checkin" | "checkout">("checkin");
  const [result, setResult] = useState<ScanResult | null>(null);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (otp.length !== 6) throw new Error("OTP must be 6 digits");

      const { data: pass, error } = await supabase
        .from("visitor_passes")
        .select(`
          id, status, valid_until, flat_id,
          visitors:visitor_id (name, purpose),
          flats:flat_id (number, towers (name))
        `)
        .eq("otp", otp)
        .eq("status", "active")
        .single();

      if (error || !pass) throw new Error("Invalid or expired OTP");

      const now = new Date();
      if (now > new Date(pass.valid_until)) {
        throw new Error("Visitor pass has expired");
      }

      await supabase.from("visitor_logs").insert({
        pass_id: pass.id,
        guard_id: profile!.id,
        action,
        timestamp: now.toISOString(),
      });

      if (action === "checkin") {
        await supabase
          .from("visitor_passes")
          .update({ status: "used" })
          .eq("id", pass.id);
      }

      const visitor = pass.visitors as { name: string; purpose: string } | null;
      const flat = pass.flats as { number: string; towers: { name: string } | null } | null;

      return {
        visitor_name: visitor?.name ?? "Unknown",
        flat: `${flat?.towers?.name ?? ""} – Flat ${flat?.number ?? ""}`,
        purpose: visitor?.purpose ?? "",
        valid_until: pass.valid_until,
      };
    },
    onSuccess: (data) => {
      setResult(data);
      setOtp("");
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="flex-row items-center justify-between py-5">
          <View>
            <Text className="text-white text-xl font-bold">Guard Portal</Text>
            <Text className="text-slate-400 text-sm">{profile?.name}</Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Text className="text-slate-400">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Action Toggle */}
        <View className="bg-slate-800 rounded-2xl p-1 flex-row mb-5">
          {(["checkin", "checkout"] as const).map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => setAction(a)}
              className={`flex-1 py-3 rounded-xl items-center ${action === a ? "bg-primary-500" : ""}`}
            >
              <Text className={`font-bold ${action === a ? "text-white" : "text-slate-400"}`}>
                {a === "checkin" ? "Check In" : "Check Out"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* OTP Input */}
        <View className="bg-slate-800 rounded-2xl p-6 mb-5">
          <Text className="text-slate-300 font-medium mb-1.5">Enter Visitor OTP</Text>
          <TextInput
            className="bg-slate-700 text-white text-4xl font-bold text-center tracking-widest rounded-xl py-4 mb-4"
            placeholder="------"
            placeholderTextColor="#475569"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, ""))}
          />
          <TouchableOpacity
            onPress={() => verifyMutation.mutate()}
            disabled={otp.length !== 6 || verifyMutation.isPending}
            className="bg-primary-500 rounded-xl py-4 items-center"
            style={{ opacity: otp.length !== 6 ? 0.6 : 1 }}
          >
            {verifyMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">
                {action === "checkin" ? "Check In Visitor" : "Check Out Visitor"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Result */}
        {result && (
          <View className="bg-green-900/40 border border-green-700 rounded-2xl p-5">
            <View className="flex-row items-center gap-2 mb-4">
              <Text className="text-2xl">✅</Text>
              <Text className="text-green-300 font-bold text-base">Access Granted</Text>
            </View>
            {[
              ["Visitor", result.visitor_name],
              ["Flat", result.flat],
              ["Purpose", result.purpose],
              ["Valid Until", formatDateTime(result.valid_until)],
            ].map(([label, value]) => (
              <View key={label} className="flex-row justify-between py-1.5">
                <Text className="text-slate-400 text-sm">{label}</Text>
                <Text className="text-white text-sm font-medium">{value}</Text>
              </View>
            ))}
          </View>
        )}

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
