import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase-client";

const PUSH_TOKEN_KEY = "dr-laundry-expo-push-token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForNativeNotifications(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("order-updates", {
      name: "Order updates",
      description: "Pickup, cleaning, readiness and delivery updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#6A1BB1",
      sound: "default",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) throw new Error("EAS project ID is missing from app configuration.");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "expo_push_token" },
  );
  if (error) throw new Error(error.message);
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  return token;
}

export async function disableCurrentDevicePushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("push_tokens")
      .update({ enabled: false, last_seen_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("expo_push_token", token);
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}
