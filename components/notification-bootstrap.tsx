import { registerForNativeNotifications } from "@/lib/push-notifications";
import { supabase } from "@/lib/supabase-client";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

const ALLOWED_ROUTES = new Set([
  "/notifications",
  "/track-order",
  "/order-history",
  "/home",
]);

function openNotification(data: Record<string, unknown>) {
  const orderId = typeof data.orderId === "string" ? data.orderId : undefined;
  const route = typeof data.route === "string" && ALLOWED_ROUTES.has(data.route)
    ? data.route
    : "/notifications";
  if (orderId && route === "/track-order") {
    router.push({ pathname: "/track-order", params: { orderId } });
  } else {
    router.push(route as never);
  }
}

export function NotificationBootstrap() {
  useEffect(() => {
    let active = true;
    const register = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      try {
        await registerForNativeNotifications();
      } catch (error) {
        console.warn("Native notification registration failed", error);
      }
    };

    void register();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void register();
    });
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => openNotification(response.notification.request.content.data),
    );

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) openNotification(response.notification.request.content.data);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      responseListener.remove();
    };
  }, []);

  return null;
}
