import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getOrders } from "@/lib/order-storage";
import {
    formatDayOnly,
    formatTimeOnly,
    getOrderStatusLabel,
    getPickupWindowLabel,
} from "@/lib/pricing";
import { OrderRecord } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PickupDatesScreen() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const loadOrders = useCallback(async () => {
    const all = await getOrders();
    const upcoming = all
      .filter((entry) => entry.status !== "delivered")
      .sort(
        (a, b) =>
          new Date(a.pickupAtISO).getTime() - new Date(b.pickupAtISO).getTime(),
      )
      .slice(0, 6);

    setOrders(upcoming);
    setLoadingOrders(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  return (
    <LinearGradient
      colors={[
        LaundryTheme.colors.bgStart,
        "#FFFFFF",
        LaundryTheme.colors.bgEnd,
      ]}
      style={styles.container}
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.headerRow}>
          <SoftPressable
            onPress={() => router.back()}
            style={styles.roundButton}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={LaundryTheme.colors.ink}
            />
          </SoftPressable>
          <Text style={styles.title}>Pickup Windows</Text>
          <View style={styles.roundButton} />
        </View>

        {loadingOrders ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={LaundryTheme.colors.primaryDark} />
            <Text style={styles.centerText}>Loading scheduled pickups...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.centerTitle}>No upcoming pickups</Text>
            <Text style={styles.centerText}>
              Standard pickup windows are 10am to 12pm and 3pm to 5pm.
            </Text>
            <SoftPressable
              onPress={() => router.replace("/new-order")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Schedule Pickup</Text>
            </SoftPressable>
          </View>
        ) : (
          <View style={styles.list}>
            {orders.map((order) => (
              <View key={order.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.day}>
                    {formatDayOnly(order.pickupAtISO)}
                  </Text>
                  <Text style={styles.status}>
                    {getOrderStatusLabel(order.status)}
                  </Text>
                </View>

                <Text style={styles.time}>
                  {formatTimeOnly(order.pickupAtISO)}
                </Text>
                <Text style={styles.window}>
                  {order.isExpress
                    ? "Immediate pickup"
                    : getPickupWindowLabel(order.pickupWindow)}
                </Text>
                <Text style={styles.address}>{order.address}</Text>
              </View>
            ))}
          </View>
        )}

        <SoftPressable
          onPress={() => router.push("/new-order")}
          style={styles.primaryButtonFooter}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Schedule Pickup</Text>
        </SoftPressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.4,
  },
  list: {
    marginTop: 20,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6EAF2",
    padding: 16,
    ...LaundryTheme.shadow.soft,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  day: {
    color: LaundryTheme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  status: {
    color: LaundryTheme.colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  time: {
    marginTop: 8,
    color: LaundryTheme.colors.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  window: {
    marginTop: 4,
    color: LaundryTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  address: {
    marginTop: 4,
    color: LaundryTheme.colors.muted,
    fontSize: 14,
  },
  primaryButtonFooter: {
    marginTop: "auto",
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    ...LaundryTheme.shadow.soft,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  centerState: {
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
    padding: 18,
    gap: 10,
    alignItems: "center",
  },
  centerTitle: {
    color: LaundryTheme.colors.ink,
    fontWeight: "800",
    fontSize: 17,
  },
  centerText: {
    color: LaundryTheme.colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
