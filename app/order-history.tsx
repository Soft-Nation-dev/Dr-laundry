import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { MODE_OPTIONS } from "@/constants/pricing";
import { getOrders } from "@/lib/order-storage";
import { formatDayOnly, formatNaira, getOrderStatusLabel } from "@/lib/pricing";
import { OrderRecord } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const loadOrders = useCallback(async () => {
    const result = await getOrders();
    setOrders(result);
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
          <Text style={styles.title}>Order History</Text>
          <View style={styles.roundButton} />
        </View>

        {loadingOrders ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={LaundryTheme.colors.primaryDark} />
            <Text style={styles.centerText}>Loading orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.centerTitle}>No orders yet</Text>
            <Text style={styles.centerText}>
              Your completed and active laundry orders will appear here.
            </Text>
            <SoftPressable
              onPress={() => router.replace("/new-order")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Create First Order</Text>
            </SoftPressable>
          </View>
        ) : (
          <View style={styles.list}>
            {orders.map((order) => (
              <SoftPressable
                key={order.id}
                onPress={() =>
                  router.push({
                    pathname: "/track-order",
                    params: { orderId: order.id },
                  })
                }
                style={styles.card}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.id}>{order.id}</Text>
                  <Text style={styles.amount}>
                    {formatNaira(order.paidAmount)}
                  </Text>
                </View>

                <View style={styles.serviceRow}>
                  <Text style={styles.service}>
                    {MODE_OPTIONS[order.mode].label}
                  </Text>
                  {order.isExpress ? (
                    <View style={styles.expressPill}>
                      <Text style={styles.expressText}>Express</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.date}>
                    {formatDayOnly(order.createdAtISO)}
                  </Text>
                  <Text style={styles.status}>
                    {getOrderStatusLabel(order.status)}
                  </Text>
                </View>
              </SoftPressable>
            ))}
          </View>
        )}
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
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 8,
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
    gap: 8,
  },
  id: {
    color: LaundryTheme.colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  amount: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    fontSize: 14,
  },
  serviceRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  service: {
    color: LaundryTheme.colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  expressPill: {
    borderRadius: 999,
    backgroundColor: LaundryTheme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expressText: {
    color: LaundryTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    color: LaundryTheme.colors.muted,
    fontSize: 12,
  },
  status: {
    color: LaundryTheme.colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  centerState: {
    marginTop: 26,
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
    fontSize: 18,
    fontWeight: "800",
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
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
