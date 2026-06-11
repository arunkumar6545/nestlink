import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSegments } from "expo-router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
});

function AuthRedirect() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "auth";
    const onPending = segments[0] === "auth" && segments[1] === "pending";

    if (!user && !inAuthGroup) {
      router.replace("/auth/login");
      return;
    }

    if (user && !profile) {
      // Logged in but no profile yet (rare — trigger may not have run)
      if (!onPending) router.replace("/auth/pending");
      return;
    }

    if (user && profile) {
      // Profile exists but no society assigned → awaiting admin approval
      if (!profile.society_id && !onPending) {
        router.replace("/auth/pending");
        return;
      }

      // Fully onboarded — go to role-appropriate home
      if (inAuthGroup) {
        const role = profile.role;
        // Super admin uses the admin screens on mobile (no separate portal)
        if (role === "admin" || role === "super_admin") router.replace("/admin");
        else if (role === "guard") router.replace("/guard");
        else router.replace("/resident");
      }
    }
  }, [user, profile, isLoading, segments]);

  return null;
}

function RootLayout() {
  return (
    <>
      <AuthRedirect />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="resident" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="guard" />
        <Stack.Screen name="auth/pending" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayout />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
