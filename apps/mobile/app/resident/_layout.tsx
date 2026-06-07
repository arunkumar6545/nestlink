import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <Text className={`text-lg ${focused ? "text-primary-500" : "text-slate-500"}`}>{emoji}</Text>
  );
}

export default function ResidentLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0ea5e9",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          paddingBottom: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="visitors"
        options={{
          title: "Visitors",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔑" label="Visitors" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: "Complaints",
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚠️" label="Complaints" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarIcon: ({ focused }) => <TabIcon emoji="💳" label="Payments" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabIcon emoji="☰" label="More" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
