import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@nestlink/core";

const menuItems = [
  { emoji: "📢", label: "Notices", href: "/resident/notices" },
  { emoji: "🏊", label: "Book Amenity", href: "/resident/amenities" },
  { emoji: "👨‍🍳", label: "Domestic Staff", href: "/resident/staff" },
  { emoji: "👨‍👩‍👧", label: "Family Members", href: "/resident/family" },
  { emoji: "🚗", label: "Vehicles", href: "/resident/vehicles" },
  { emoji: "👤", label: "Profile", href: "/resident/profile" },
];

export default function MoreScreen() {
  const { profile, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">More</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm">
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 bg-primary-100 rounded-2xl items-center justify-center">
              <Text className="text-primary-500 text-xl font-bold">
                {profile?.name ? getInitials(profile.name) : "?"}
              </Text>
            </View>
            <View>
              <Text className="font-bold text-gray-800 text-base">{profile?.name}</Text>
              <Text className="text-gray-500 text-sm">{profile?.phone}</Text>
              <Text className="text-primary-500 text-xs font-medium capitalize mt-0.5">
                {profile?.role}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          {menuItems.map((item, index) => (
            <Link key={item.href} href={item.href as never} asChild>
              <TouchableOpacity
                className={`flex-row items-center px-5 py-4 ${index < menuItems.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <Text className="text-xl w-8">{item.emoji}</Text>
                <Text className="text-gray-800 font-medium flex-1 ml-2">{item.label}</Text>
                <Text className="text-gray-400">›</Text>
              </TouchableOpacity>
            </Link>
          ))}
        </View>

        {/* Sign Out */}
        <View className="mx-4 mt-4 mb-8">
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-red-50 border border-red-100 rounded-2xl p-4 items-center"
          >
            <Text className="text-red-600 font-bold">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
