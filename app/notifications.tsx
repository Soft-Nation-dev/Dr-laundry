import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  AppNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setItems(await getNotifications());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNotification = async (item: AppNotification) => {
    if (!item.readAt) {
      await markNotificationRead(item.id);
      setItems((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
      ));
    }
    if (item.orderId) {
      router.push({ pathname: "/track-order", params: { orderId: item.orderId } });
    } else if (item.route) {
      router.push(item.route as never);
    }
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
  };

  return (
    <LinearGradient colors={[LaundryTheme.colors.bgStart, "#FFFFFF", LaundryTheme.colors.bgEnd]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}>
          <SoftPressable onPress={() => router.replace("/home")} style={styles.roundButton}>
            <Ionicons name="chevron-back" size={20} color={LaundryTheme.colors.ink} />
          </SoftPressable>
          <Text style={styles.title}>Notifications</Text>
          <SoftPressable onPress={markAllRead} style={styles.readButton}>
            <Text style={styles.readText}>Read all</Text>
          </SoftPressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={LaundryTheme.colors.primary} />
              <Text style={styles.centerText}>Loading updates...</Text>
            </View>
          ) : error ? (
            <SoftPressable onPress={() => load()} style={styles.centerState}>
              <Ionicons name="cloud-offline-outline" size={28} color={LaundryTheme.colors.danger} />
              <Text style={styles.centerTitle}>Could not load updates</Text>
              <Text style={styles.centerText}>{error}</Text>
              <Text style={styles.retry}>Tap to retry</Text>
            </SoftPressable>
          ) : items.length === 0 ? (
            <View style={styles.centerState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={28} color={LaundryTheme.colors.primaryDark} />
              </View>
              <Text style={styles.centerTitle}>You are all caught up</Text>
              <Text style={styles.centerText}>Pickup and order updates will appear here.</Text>
            </View>
          ) : (
            items.map((item) => (
              <SoftPressable key={item.id} onPress={() => openNotification(item)} style={[styles.card, !item.readAt && styles.cardUnread]}>
                <View style={[styles.itemIcon, !item.readAt && styles.itemIconUnread]}>
                  <Ionicons
                    name={item.kind === "order" ? "shirt-outline" : "notifications-outline"}
                    size={20}
                    color={LaundryTheme.colors.primaryDark}
                  />
                </View>
                <View style={styles.copy}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!item.readAt ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                </View>
              </SoftPressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roundButton: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LaundryTheme.colors.border },
  title: { color: LaundryTheme.colors.ink, fontSize: 22, fontWeight: "800" },
  readButton: { minWidth: 56, alignItems: "flex-end", paddingVertical: 10 },
  readText: { color: LaundryTheme.colors.primary, fontSize: 11, fontWeight: "800" },
  content: { paddingTop: 18, paddingBottom: LaundryTheme.layout.bottomMenuSpace + 20, gap: 10 },
  card: { flexDirection: "row", gap: 12, borderRadius: 18, padding: 14, backgroundColor: "rgba(255,255,255,0.76)", borderWidth: 1, borderColor: LaundryTheme.colors.border },
  cardUnread: { backgroundColor: "#FFFFFF", borderColor: LaundryTheme.colors.accent, ...LaundryTheme.shadow.soft },
  itemIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F1FB" },
  itemIconUnread: { backgroundColor: LaundryTheme.colors.primarySoft },
  copy: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, color: LaundryTheme.colors.ink, fontSize: 13, fontWeight: "800" },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: LaundryTheme.colors.primary },
  body: { marginTop: 4, color: LaundryTheme.colors.muted, fontSize: 11, lineHeight: 16 },
  time: { marginTop: 7, color: "#968AA8", fontSize: 9, fontWeight: "700" },
  centerState: { marginTop: 24, padding: 24, borderRadius: 20, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LaundryTheme.colors.border },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft, marginBottom: 12 },
  centerTitle: { color: LaundryTheme.colors.ink, fontSize: 16, fontWeight: "800", marginTop: 8 },
  centerText: { color: LaundryTheme.colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 5 },
  retry: { color: LaundryTheme.colors.primary, fontSize: 11, fontWeight: "800", marginTop: 12 },
});
