import { LiveOrderMap } from "@/components/live-order-map";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getOrderById } from "@/lib/order-storage";
import { formatDateTime, hoursUntil } from "@/lib/pricing";
import type { OrderRecord } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PickupMapScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    void getOrderById(orderId).then((result) => { setOrder(result); setLoading(false); });
  }, [orderId]);

  return (
    <LinearGradient colors={["#FBF9FF", "#FFFFFF", LaundryTheme.colors.primarySoft]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}>
          <SoftPressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={21} color={LaundryTheme.colors.ink} /></SoftPressable>
          <View style={styles.headerCopy}><Text style={styles.kicker}>Live journey</Text><Text style={styles.title}>Driver tracking</Text></View>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {orderId ? <LiveOrderMap orderId={orderId} height={390} /> : null}
          {loading ? <ActivityIndicator style={styles.loader} color={LaundryTheme.colors.primary} /> : order ? (
            <View style={styles.details}>
              <View style={styles.orderRow}><View><Text style={styles.label}>ORDER</Text><Text style={styles.orderId}>{order.id}</Text></View><View style={styles.servicePill}><Ionicons name={order.isExpress ? "flash" : "calendar-outline"} size={14} color={LaundryTheme.colors.primaryDark} /><Text style={styles.serviceText}>{order.isExpress ? "24h Express" : "72h Standard"}</Text></View></View>
              <View style={styles.metricRow}>
                <View style={styles.metric}><Text style={styles.label}>PICKUP</Text><Text style={styles.metricValue}>{formatDateTime(order.pickupAtISO)}</Text></View>
                <View style={styles.metric}><Text style={styles.label}>PROMISED RETURN</Text><Text style={styles.metricValue}>{formatDateTime(order.promisedDeliveryISO)}</Text></View>
                <View style={styles.metric}><Text style={styles.label}>COUNTDOWN</Text><Text style={styles.metricValue}>{hoursUntil(order.promisedDeliveryISO)}h left</Text></View>
              </View>
              <SoftPressable onPress={() => router.push({ pathname: "/track-order", params: { orderId: order.id } })} style={styles.button}><Text style={styles.buttonText}>View full order journey</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></SoftPressable>
            </View>
          ) : <View style={styles.details}><Text style={styles.orderId}>Order unavailable</Text><Text style={styles.empty}>Return to Orders and choose an active order.</Text></View>}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 }, header: { minHeight: 72, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" }, back: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.soft }, headerCopy: { marginLeft: 12 }, kicker: { color: LaundryTheme.colors.primaryDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }, title: { marginTop: 2, color: LaundryTheme.colors.ink, fontSize: 25, fontWeight: "900" }, content: { paddingHorizontal: 16, paddingBottom: LaundryTheme.layout.bottomMenuSpace + 28 }, loader: { marginTop: 24 }, details: { marginTop: 14, borderRadius: 24, padding: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LaundryTheme.colors.border, ...LaundryTheme.shadow.soft }, orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, label: { color: LaundryTheme.colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, orderId: { marginTop: 3, color: LaundryTheme.colors.ink, fontSize: 18, fontWeight: "900" }, servicePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 13, backgroundColor: LaundryTheme.colors.primarySoft }, serviceText: { color: LaundryTheme.colors.primaryDark, fontSize: 10, fontWeight: "800" }, metricRow: { marginTop: 14, flexDirection: "row", gap: 8 }, metric: { flex: 1, minHeight: 76, borderRadius: 15, padding: 10, backgroundColor: "#FAF7FF" }, metricValue: { marginTop: 5, color: LaundryTheme.colors.ink, fontSize: 10, fontWeight: "800", lineHeight: 14 }, button: { marginTop: 14, minHeight: 51, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primary }, buttonText: { color: "#FFFFFF", fontWeight: "900" }, empty: { marginTop: 7, color: LaundryTheme.colors.muted, lineHeight: 19 },
});

