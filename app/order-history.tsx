import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getOrders } from "@/lib/order-storage";
import { formatDayOnly, formatNaira, getOrderStatusLabel } from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import type { OrderRecord, OrderStatus } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type OrderTab = "active" | "completed" | "cancelled";

const tabs: { key: OrderTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const statusMeta: Record<OrderStatus, { progress: number; icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  "pickup-confirmed": { progress: 20, icon: "basket-outline", tint: "#7740D6" },
  processing: { progress: 55, icon: "water-outline", tint: "#5B21B6" },
  "ready-for-delivery": { progress: 75, icon: "calendar-outline", tint: "#087A58" },
  "out-for-delivery": { progress: 82, icon: "bicycle-outline", tint: "#B86B00" },
  delivered: { progress: 100, icon: "checkmark-circle-outline", tint: "#149A6E" },
  cancelled: { progress: 0, icon: "close-circle-outline", tint: "#C84A68" },
};

function tabForStatus(status: OrderStatus): OrderTab {
  if (status === "delivered") return "completed";
  if (status === "cancelled") return "cancelled";
  return "active";
}

function orderSummary(order: OrderRecord): string {
  const items = order.lineItems.filter((item) => item.quantity > 0);
  if (!items.length) return order.isExpress ? "Express laundry service" : "Standard laundry service";
  const labels = items.slice(0, 3).map((item) => `${item.quantity} ${item.name}`);
  return `${labels.join(", ")}${items.length > 3 ? ` +${items.length - 3} more` : ""}`;
}

function primaryAction(status: OrderStatus): string {
  if (status === "pickup-confirmed") return "Track Pickup";
  if (status === "processing") return "Live Track";
  if (status === "ready-for-delivery") return "Confirm Delivery";
  if (status === "out-for-delivery") return "Track Delivery";
  if (status === "delivered") return "View Receipt";
  return "Book Again";
}

function OrderCard({ order, index }: { order: OrderRecord; index: number }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const meta = statusMeta[order.status];

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      delay: Math.min(index * 70, 280),
      damping: 16,
      stiffness: 145,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  const openTracking = () => router.push({ pathname: "/track-order", params: { orderId: order.id } });
  const handlePrimary = () => {
    if (order.status === "cancelled") return router.push("/new-order");
    if (order.status === "ready-for-delivery" && order.deliveryConfirmationStatus !== "confirmed") {
      return router.push({ pathname: "/confirm-delivery", params: { orderId: order.id } } as never);
    }
    return openTracking();
  };

  return (
    <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={[styles.statusIcon, { backgroundColor: `${meta.tint}14` }]}>
            <Ionicons name={meta.icon} size={22} color={meta.tint} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusLabel, { color: meta.tint }]}>{getOrderStatusLabel(order.status).toUpperCase()}</Text>
            {order.status !== "cancelled" ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${meta.progress}%`, backgroundColor: meta.tint }]} /></View> : null}
          </View>
          <Text style={[styles.progressText, { color: meta.tint }]}>{order.status === "cancelled" ? "—" : `${meta.progress}%`}</Text>
        </View>

        <View style={styles.orderTitleRow}>
          <Text style={styles.orderId}>Order ID: #{order.id}</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{formatNaira(order.paidAmount)}</Text>
        </View>
        <Text style={styles.dateLine}>Placed: {formatDayOnly(order.createdAtISO)} · Est. delivery: {formatDayOnly(order.promisedDeliveryISO)}</Text>
        <Text style={styles.itemLine} numberOfLines={2}>{orderSummary(order)}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.servicePill}>
            <Ionicons name={order.isExpress ? "flash" : "time-outline"} size={12} color="#5B168F" />
            <Text style={styles.servicePillText}>{order.isExpress ? "24h Express" : "72h Standard"}</Text>
          </View>
          <Text style={styles.address} numberOfLines={1}>{order.address}</Text>
        </View>

        <View style={styles.actions}>
          <SoftPressable onPress={handlePrimary} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{primaryAction(order.status)}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </SoftPressable>
          {order.status !== "cancelled" ? <SoftPressable onPress={openTracking} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>View Details</Text></SoftPressable> : null}
        </View>
      </View>
    </Animated.View>
  );
}

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [activeTab, setActiveTab] = useState<OrderTab>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setError("");
    try { setOrders(await getOrders()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Orders could not be loaded."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadOrders(); }, [loadOrders]));

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;
      channel = supabase.channel(`customer-orders-${data.user.id}`).on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${data.user.id}` },
        () => { void loadOrders(true); },
      );
      channel.subscribe();
    });
    return () => { mounted = false; if (channel) void supabase.removeChannel(channel); };
  }, [loadOrders]);

  const filteredOrders = useMemo(() => orders.filter((order) => tabForStatus(order.status) === activeTab), [activeTab, orders]);

  return (
    <LinearGradient colors={["#F9F3FF", "#FFFFFF", "#F0E4FF"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} tintColor="#5B168F" onRefresh={() => { setRefreshing(true); void loadOrders(); }} />}>
          <View style={styles.headerRow}>
            <View><Text style={styles.eyebrow}>YOUR LAUNDRY JOURNEY</Text><Text style={styles.title}>My Orders</Text></View>
            <SoftPressable onPress={() => router.push("/new-order")} style={styles.addButton}><Ionicons name="add" size={24} color="#FFFFFF" /></SoftPressable>
          </View>

          <View style={styles.tabs}>
            {tabs.map((tab) => {
              const active = tab.key === activeTab;
              const count = orders.filter((order) => tabForStatus(order.status) === tab.key).length;
              return <SoftPressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{tab.label}</Text>{count > 0 ? <View style={[styles.countBadge, active && styles.activeCountBadge]}><Text style={[styles.countText, active && styles.activeCountText]}>{count}</Text></View> : null}</SoftPressable>;
            })}
          </View>

          {loading ? <View style={styles.centerState}><ActivityIndicator color="#5B168F" /><Text style={styles.centerText}>Loading your orders…</Text></View>
          : error ? <View style={styles.centerState}><Ionicons name="cloud-offline-outline" size={28} color="#C84A68" /><Text style={styles.centerTitle}>Couldn’t load orders</Text><Text style={styles.centerText}>{error}</Text><SoftPressable onPress={() => void loadOrders()} style={styles.retryButton}><Text style={styles.retryText}>Try Again</Text></SoftPressable></View>
          : filteredOrders.length === 0 ? <View style={styles.centerState}><View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={30} color="#6A1BB1" /></View><Text style={styles.centerTitle}>No {activeTab} orders</Text><Text style={styles.centerText}>{activeTab === "active" ? "A new laundry order will appear here from pickup to delivery." : `Your ${activeTab} orders will be kept here.`}</Text>{activeTab === "active" ? <SoftPressable onPress={() => router.push("/new-order")} style={styles.retryButton}><Text style={styles.retryText}>Book New Service</Text></SoftPressable> : null}</View>
          : <View style={styles.list}>{filteredOrders.map((order, index) => <OrderCard key={order.id} order={order} index={index} />)}</View>}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: LaundryTheme.layout.bottomMenuSpace + 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, eyebrow: { color: "#7A6892", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }, title: { color: LaundryTheme.colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -1.2, marginTop: 2 },
  addButton: { width: 48, height: 48, borderRadius: 17, backgroundColor: "#5B168F", alignItems: "center", justifyContent: "center", ...LaundryTheme.shadow.soft },
  tabs: { marginTop: 22, backgroundColor: "#E7DFED", borderRadius: 18, padding: 4, flexDirection: "row" }, tab: { flex: 1, minHeight: 45, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, activeTab: { backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.soft },
  tabText: { color: "#4B4356", fontSize: 14, fontWeight: "700" }, activeTabText: { color: "#24182F", fontWeight: "900" }, countBadge: { minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: "#D2C6DA", alignItems: "center", justifyContent: "center" }, activeCountBadge: { backgroundColor: "#F0E3FC" }, countText: { color: "#6C6177", fontSize: 10, fontWeight: "900" }, activeCountText: { color: "#5B168F" },
  list: { marginTop: 18, gap: 16 }, card: { backgroundColor: "#FFFFFF", borderRadius: 25, padding: 18, borderWidth: 1, borderColor: "#EDE6F2", shadowColor: "#59118D", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 11 }, statusIcon: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center" }, statusCopy: { flex: 1 }, statusLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }, progressTrack: { height: 6, borderRadius: 99, backgroundColor: "#E7E3EA", overflow: "hidden", marginTop: 7 }, progressFill: { height: "100%", borderRadius: 99 }, progressText: { fontSize: 13, fontWeight: "900" },
  orderTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 17 }, orderId: { flex: 1, color: "#17111C", fontSize: 19, fontWeight: "900", letterSpacing: -0.35 }, amount: { maxWidth: 105, color: "#5B168F", fontSize: 16, fontWeight: "900" }, dateLine: { color: "#766E7D", fontSize: 12, lineHeight: 18, marginTop: 6 }, itemLine: { color: "#302838", fontSize: 14, fontWeight: "700", lineHeight: 20, marginTop: 8 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 }, servicePill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#F2E7FB" }, servicePillText: { color: "#5B168F", fontSize: 10, fontWeight: "900" }, address: { flex: 1, color: "#8A8191", fontSize: 11 },
  actions: { flexDirection: "row", gap: 10, marginTop: 17 }, primaryAction: { flex: 1.15, minHeight: 49, borderRadius: 16, backgroundColor: "#5B168F", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, primaryActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", textTransform: "uppercase" }, secondaryAction: { flex: 1, minHeight: 49, borderRadius: 16, borderWidth: 1, borderColor: "#DED5E5", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }, secondaryActionText: { color: "#24182F", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  centerState: { marginTop: 24, borderRadius: 24, borderWidth: 1, borderColor: "#EAE2EF", backgroundColor: "rgba(255,255,255,0.92)", padding: 24, gap: 10, alignItems: "center" }, emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#F1E5FB", alignItems: "center", justifyContent: "center" }, centerTitle: { color: LaundryTheme.colors.ink, fontSize: 18, fontWeight: "900" }, centerText: { color: LaundryTheme.colors.muted, textAlign: "center", lineHeight: 20 }, retryButton: { marginTop: 6, backgroundColor: "#5B168F", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }, retryText: { color: "#FFFFFF", fontWeight: "900" },
});
