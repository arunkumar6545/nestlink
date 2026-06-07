import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatRelative } from "@nestlink/core";
import { SafeAreaView } from "react-native-safe-area-context";

const quickLinks = [
  { label: "Invite Visitor", emoji: "🔑", href: "/resident/visitors" },
  { label: "Raise Complaint", emoji: "⚠️", href: "/resident/complaints" },
  { label: "Pay Dues", emoji: "💳", href: "/resident/payments" },
  { label: "Book Amenity", emoji: "🏊", href: "/resident/amenities" },
  { label: "Notices", emoji: "📢", href: "/resident/notices" },
  { label: "My Staff", emoji: "👨‍🍳", href: "/resident/staff" },
];

export default function ResidentHomeScreen() {
  const { profile } = useAuth();

  const { data: pendingInvoice, refetch: refetchInvoice, isLoading: loadingInvoice } = useQuery({
    queryKey: ["mobile-pending-invoice", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, amount, period, due_date")
        .eq("status", "pending")
        .order("due_date")
        .limit(1)
        .single();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: notices, refetch: refetchNotices } = useQuery({
    queryKey: ["mobile-notices", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("id, title, type, created_at")
        .eq("society_id", profile!.society_id!)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const noticeColors: Record<string, string> = {
    urgent: "#ef4444",
    info: "#0ea5e9",
    event: "#8b5cf6",
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl onRefresh={() => { refetchInvoice(); refetchNotices(); }} refreshing={false} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-primary-500 px-5 pt-4 pb-8">
          <Text className="text-primary-100 text-sm">Good day,</Text>
          <Text className="text-white text-2xl font-bold mt-0.5">{profile?.name ?? "Resident"}</Text>
          <Text className="text-primary-200 text-sm mt-1">Welcome to your society</Text>
        </View>

        <View className="px-4 -mt-4 space-y-4">
          {/* Pending Invoice Alert */}
          {pendingInvoice && (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-bold text-amber-900">Payment Due</Text>
                  <Text className="text-amber-700 text-sm mt-0.5">
                    {pendingInvoice.period} — {formatCurrency(pendingInvoice.amount)}
                  </Text>
                </View>
                <Link href="/resident/payments" asChild>
                  <TouchableOpacity className="bg-amber-500 rounded-xl px-4 py-2">
                    <Text className="text-white font-bold text-sm">Pay Now</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
              Quick Actions
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href as never} asChild>
                  <TouchableOpacity className="items-center w-[30%]">
                    <View className="w-14 h-14 bg-gray-100 rounded-2xl items-center justify-center mb-1.5">
                      <Text className="text-2xl">{link.emoji}</Text>
                    </View>
                    <Text className="text-xs text-gray-600 text-center font-medium">{link.label}</Text>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          </View>

          {/* Recent Notices */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-semibold text-gray-800">Recent Notices</Text>
              <Link href="/resident/notices" asChild>
                <TouchableOpacity>
                  <Text className="text-primary-500 text-sm">View all</Text>
                </TouchableOpacity>
              </Link>
            </View>
            {notices?.length === 0 && (
              <Text className="text-gray-400 text-sm text-center py-4">No notices yet</Text>
            )}
            {notices?.map((notice) => (
              <View key={notice.id} className="flex-row items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                <View
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: noticeColors[notice.type] ?? "#64748b" }}
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>
                    {notice.title}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {formatRelative(notice.created_at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
