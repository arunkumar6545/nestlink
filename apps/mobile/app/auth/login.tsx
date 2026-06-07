import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState("");

  async function sendOtp() {
    const raw = phone.trim().replace(/\s/g, "");
    if (raw.length < 10) {
      Alert.alert("Invalid number", "Please enter a 10-digit phone number");
      return;
    }
    setIsLoading(true);
    const formatted = raw.startsWith("+") ? raw : `+91${raw}`;
    setFormattedPhone(formatted);

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setStep("otp");
    }
    setIsLoading(false);
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit code");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: "sms",
    });
    if (error) {
      Alert.alert("Wrong OTP", error.message);
    }
    // On success, onAuthStateChange in useAuth fires → profile fetched → redirect
    setIsLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-900"
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
        className="px-6"
      >
        {/* ─── Logo ─────────────────────────────────────────── */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 bg-primary rounded-2xl items-center justify-center mb-4">
            <Text className="text-4xl">🏢</Text>
          </View>
          <Text className="text-white text-3xl font-bold">Nestlink</Text>
          <Text className="text-slate-400 text-sm mt-1">
            Your society's digital backbone
          </Text>
        </View>

        {/* ─── Role pills (info only) ────────────────────────── */}
        {step === "phone" && (
          <View className="flex-row gap-2 mb-6 justify-center flex-wrap">
            {[
              { label: "Resident", color: "bg-sky-500/20 border-sky-700/40", text: "text-sky-300" },
              { label: "Admin",    color: "bg-violet-500/20 border-violet-700/40", text: "text-violet-300" },
              { label: "Guard",    color: "bg-green-500/20 border-green-700/40", text: "text-green-300" },
            ].map(({ label, color, text }) => (
              <View key={label} className={`px-3 py-1 rounded-full border ${color}`}>
                <Text className={`text-xs font-semibold ${text}`}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Card ─────────────────────────────────────────── */}
        <View className="bg-slate-800 rounded-2xl p-6 shadow-xl">
          {step === "phone" ? (
            <>
              <Text className="text-white text-xl font-bold mb-1">Sign in</Text>
              <Text className="text-slate-400 text-sm mb-6 leading-relaxed">
                One login for all roles — your access level is set by your society
                admin.
              </Text>

              <Text className="text-slate-300 text-sm font-medium mb-2">
                Phone Number
              </Text>
              <View className="flex-row items-center bg-slate-700 rounded-xl px-4 mb-4 border border-slate-600">
                <Text className="text-slate-400 text-base mr-2">+91</Text>
                <TextInput
                  className="flex-1 text-white py-4 text-base"
                  placeholder="9876543210"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  returnKeyType="done"
                  onSubmitEditing={sendOtp}
                />
              </View>

              <TouchableOpacity
                onPress={sendOtp}
                disabled={isLoading || phone.length < 10}
                className={`rounded-xl py-4 items-center ${
                  phone.length >= 10 ? "bg-primary" : "bg-primary/50"
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    Send OTP →
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-white text-xl font-bold mb-1">
                Enter OTP
              </Text>
              <Text className="text-slate-400 text-sm mb-6">
                Sent to {formattedPhone}
              </Text>

              <TextInput
                className="bg-slate-700 text-white text-4xl font-bold text-center tracking-widest rounded-xl py-4 mb-4 border border-slate-600"
                placeholder="— — — — — —"
                placeholderTextColor="#64748b"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />

              <TouchableOpacity
                onPress={verifyOtp}
                disabled={isLoading || otp.length !== 6}
                className={`rounded-xl py-4 items-center mb-3 ${
                  otp.length === 6 ? "bg-primary" : "bg-primary/50"
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    Verify & Sign In
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setStep("phone");
                  setOtp("");
                }}
                className="py-2"
              >
                <Text className="text-slate-400 text-center text-sm">
                  ← Change phone number
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ─── Bottom note ──────────────────────────────────── */}
        <Text className="text-slate-600 text-xs text-center mt-6 px-4 leading-relaxed">
          Your role (resident, admin, or guard) is automatically assigned when
          your admin invites you. First time? Ask your society admin.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
