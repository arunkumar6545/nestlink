import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text className={`text-lg ${focused ? "text-primary-500" : "text-slate-500"}`}>{emoji}</Text>;
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0ea5e9",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: { backgroundColor: "#ffffff", borderTopColor: "#e2e8f0" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }}
      />
      <Tabs.Screen
        name="residents"
        options={{ title: "Residents", tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: "Complaints", tabBarIcon: ({ focused }) => <TabIcon emoji="⚠️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="notices"
        options={{ title: "Notices", tabBarIcon: ({ focused }) => <TabIcon emoji="📢" focused={focused} /> }}
      />
    </Tabs>
  );
}
