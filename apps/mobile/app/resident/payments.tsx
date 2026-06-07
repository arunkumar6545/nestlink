import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/utils";

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  paid: { bg: "#dcfce7", text: "#166534" },
  overdue: { bg: "#fee2e2", text: "#991b1b" },
  cancelled: { bg: "#f1f5f9", text: "#64748b" },
};

export default function PaymentsScreen() {
  const { profile } = useAuth();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["mobile-invoices", profile?.id],
    queryFn: async () => {
      const { data: resident } = await supabase
        .from("residents")
        .select("flat_id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) return [];

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("flat_id", resident.flat_id)
        .order("period", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const pending = invoices?.filter((i) => i.status === "pending" || i.status === "overdue") ?? [];
  const paid = invoices?.filter((i) => i.status === "paid") ?? [];

  async function handlePay(_invoiceId: string) {
    Alert.alert(
      "Pay via Razorpay",
      "This will open Razorpay payment. Ensure react-native-razorpay is integrated.",
      [{ text: "OK" }]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Payments</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}

        {pending.length > 0 && (
          <>
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
              <Text className="font-bold text-amber-900">Outstanding Dues</Text>
              <Text className="text-3xl font-bold text-amber-800 mt-1">
                {formatCurrency(pending.reduce((s, i) => s + i.amount + i.late_fee, 0))}
              </Text>
              <Text className="text-amber-700 text-sm mt-1">{pending.length} invoice(s) pending</Text>
            </View>

            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
              Due Invoices
            </Text>
            {pending.map((inv) => (
              <View key={inv.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-bold text-gray-800">{formatPeriod(inv.period)}</Text>
                    <Text className="text-gray-500 text-sm">Due: {formatDate(inv.due_date)}</Text>
                    {inv.late_fee > 0 && (
                      <Text className="text-red-500 text-xs">
                        + {formatCurrency(inv.late_fee)} late fee
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-2xl font-bold text-gray-800">
                      {formatCurrency(inv.amount)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handlePay(inv.id)}
                      className="bg-primary-500 rounded-xl px-4 py-2 mt-2"
                    >
                      <Text className="text-white font-bold text-sm">Pay Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {paid.length > 0 && (
          <>
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3 mt-2">
              Payment History
            </Text>
            {paid.map((inv) => {
              const colors = statusColors[inv.status];
              return (
                <View key={inv.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="font-bold text-gray-800">{formatPeriod(inv.period)}</Text>
                      <Text className="text-gray-400 text-sm">{formatDate(inv.due_date)}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-bold text-gray-800">{formatCurrency(inv.amount)}</Text>
                      <View
                        className="rounded-full px-3 py-1 mt-1"
                        style={{ backgroundColor: colors.bg }}
                      >
                        <Text
                          className="text-xs font-semibold capitalize"
                          style={{ color: colors.text }}
                        >
                          {inv.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {!isLoading && invoices?.length === 0 && (
          <View className="items-center mt-20">
            <Text className="text-4xl mb-3">💳</Text>
            <Text className="text-gray-400">No invoices yet</Text>
          </View>
        )}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
