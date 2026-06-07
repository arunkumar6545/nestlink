import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@nestlink/core";

interface StatCardProps { title: string; value: string | number; emoji: string; color: string }

function StatCard({ title, value, emoji, color }: StatCardProps) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm">
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <Text className="text-xl">{emoji}</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-800">{value}</Text>
      <Text className="text-gray-500 text-xs mt-0.5">{title}</Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const { profile, signOut } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["admin-mobile-stats", profile?.society_id],
    queryFn: async () => {
      const [residents, complaints, collection] = await Promise.all([
        supabase.from("residents").select("id, approved_at", { count: "exact" }),
        supabase.from("complaints").select("id, status", { count: "exact" }),
        supabase.from("invoices").select("amount").eq("status", "paid"),
      ]);

      return {
        totalResidents: residents.count ?? 0,
        pendingApprovals: (residents.data ?? []).filter((r) => !r.approved_at).length,
        openComplaints: (complaints.data ?? []).filter((c) => c.status === "open").length,
        monthCollection: (collection.data ?? []).reduce((s, i) => s + i.amount, 0),
      };
    },
    enabled: !!profile?.society_id,
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <View>
          <Text className="text-xl font-bold text-gray-800">Admin Dashboard</Text>
          <Text className="text-gray-500 text-sm">{profile?.name}</Text>
        </View>
        <TouchableOpacity
          onPress={() => Alert.alert("Sign Out", "Sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: signOut },
          ])}
        >
          <Text className="text-red-500 text-sm font-medium">Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Total Residents" value={stats?.totalResidents ?? "—"} emoji="👥" color="#0ea5e9" />
          <StatCard title="Pending Approvals" value={stats?.pendingApprovals ?? "—"} emoji="⏳" color="#f59e0b" />
        </View>
        <View className="flex-row gap-3 mb-6">
          <StatCard title="Open Complaints" value={stats?.openComplaints ?? "—"} emoji="⚠️" color="#ef4444" />
          <StatCard title="Collection" value={formatCurrency(stats?.monthCollection ?? 0)} emoji="💰" color="#22c55e" />
        </View>

        <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
          Quick Actions
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {[
            { emoji: "👥", label: "Manage Residents", sub: "Approve/reject new residents" },
            { emoji: "⚠️", label: "Complaints", sub: "View and update complaints" },
            { emoji: "📢", label: "Send Notice", sub: "Broadcast to all residents" },
            { emoji: "💳", label: "Generate Invoices", sub: "Bulk maintenance billing" },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              className={`flex-row items-center px-5 py-4 ${i < 3 ? "border-b border-gray-100" : ""}`}
            >
              <Text className="text-xl w-8">{item.emoji}</Text>
              <View className="flex-1 ml-3">
                <Text className="font-medium text-gray-800">{item.label}</Text>
                <Text className="text-gray-400 text-xs">{item.sub}</Text>
              </View>
              <Text className="text-gray-400">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
