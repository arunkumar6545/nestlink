import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/hooks/useAuth";

export default function PendingScreen() {
  const { signOut, user } = useAuth();

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      className="flex-1 bg-slate-900"
    >
      <StatusBar style="light" />
      <View className="flex-1 justify-center px-6 py-12">
        {/* Icon */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 bg-amber-500/20 rounded-3xl items-center justify-center mb-4">
            <Text className="text-5xl">⏳</Text>
          </View>
          <Text className="text-white text-2xl font-bold text-center">
            Awaiting Approval
          </Text>
          <Text className="text-slate-400 text-sm mt-2 text-center leading-relaxed">
            Your phone number has been registered but hasn't been assigned to a
            society yet.
          </Text>
        </View>

        {/* Info card */}
        <View className="bg-slate-800 rounded-2xl p-5 mb-6 space-y-4">
          <Text className="text-white font-semibold text-base mb-1">
            What happens next?
          </Text>

          {[
            {
              step: "1",
              title: "Contact your society admin",
              desc: "Ask your society manager or admin to invite you via the Nestlink web portal.",
            },
            {
              step: "2",
              title: "Admin invites you",
              desc: `They'll add your number (${user?.phone ?? "your phone"}) with your role and flat.`,
            },
            {
              step: "3",
              title: "Sign out and sign in again",
              desc: "Once they've added you, sign out and log back in — you'll be automatically onboarded.",
            },
          ].map(({ step, title, desc }) => (
            <View key={step} className="flex-row gap-3 items-start">
              <View className="w-7 h-7 rounded-full bg-primary items-center justify-center shrink-0 mt-0.5">
                <Text className="text-white text-xs font-bold">{step}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium text-sm">{title}</Text>
                <Text className="text-slate-400 text-xs mt-1 leading-relaxed">{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Admin info */}
        <View className="bg-sky-900/40 border border-sky-700/50 rounded-xl px-4 py-3 mb-8">
          <Text className="text-sky-300 text-xs font-semibold mb-1">
            Are you a Super Admin?
          </Text>
          <Text className="text-sky-200/80 text-xs leading-relaxed">
            Open the Nestlink web app, create your society, then come back and
            sign in here — you'll be recognized as the admin.
          </Text>
        </View>

        <TouchableOpacity
          onPress={signOut}
          className="bg-slate-700 rounded-xl py-4 items-center"
        >
          <Text className="text-white font-semibold">Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
