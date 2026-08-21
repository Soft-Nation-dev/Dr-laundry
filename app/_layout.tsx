import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import "@/lib/driver-location-task";

import { RootBottomMenu } from "@/components/root-bottom-menu";
import { NotificationBootstrap } from "@/components/notification-bootstrap";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="home" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="pickup-dates" />
        <Stack.Screen name="order-history" />
        <Stack.Screen name="membership" />
        <Stack.Screen name="support" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="new-order" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="payment-history" />
        <Stack.Screen name="pickup-map" />
        <Stack.Screen name="track-order" />
        <Stack.Screen name="order-complete" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/orders" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="driver/home" />
        <Stack.Screen name="driver/task-detail" />
        <Stack.Screen name="driver/completed" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      <RootBottomMenu />
      <NotificationBootstrap />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
