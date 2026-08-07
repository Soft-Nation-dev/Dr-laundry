import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getOrderById } from "@/lib/order-storage";
import {
  formatDateTime,
  formatNaira,
  getDeliveryDayLabel,
  getDeliveryWindowLabel,
  getPickupDayLabel,
  getPickupWindowLabel,
} from "@/lib/pricing";
import { OrderRecord } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrderCompleteScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);

  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentOffset = useRef(new Animated.Value(24)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation for the check circle
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        setLoadingOrder(false);
        return;
      }

      const existing = await getOrderById(orderId);
      if (!existing) {
        setLoadingOrder(false);
        return;
      }

      setOrder(existing);

      setLoadingOrder(false);

      // Animate in after order loads
      Animated.sequence([
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 10,
            bounciness: 14,
          }),
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(contentOffset, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
      ]).start();
    };

    loadOrder();
  }, [orderId, checkOpacity, checkScale, contentOffset, contentOpacity]);

  if (loadingOrder) {
    return (
      <LinearGradient
        colors={[LaundryTheme.colors.primarySoft, "#FFFFFF"]}
        style={styles.container}
      >
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator color={LaundryTheme.colors.primaryDark} size="large" />
          <Text style={styles.loadingText}>Loading receipt…</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!order) {
    return (
      <LinearGradient colors={["#FAF7FF", "#FFFFFF"]} style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={LaundryTheme.colors.muted} />
          <Text style={styles.emptyTitle}>No order found</Text>
          <Text style={styles.emptyBody}>We couldn't locate this order.</Text>
          <SoftPressable onPress={() => router.replace("/home")} style={styles.homeBtn}>
            <Text style={styles.homeBtnText}>Go to Home</Text>
          </SoftPressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[LaundryTheme.colors.primarySoft, "#FFFFFF", "#F9F7FF"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero success section */}
          <View style={styles.heroSection}>
            <Animated.View
              style={[
                styles.checkRing,
                {
                  opacity: checkOpacity,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
                <Ionicons name="checkmark" size={36} color="#fff" />
              </Animated.View>
            </Animated.View>

            <Animated.View
              style={{ opacity: checkOpacity, transform: [{ translateY: contentOffset }] }}
            >
              <Text style={styles.heroTitle}>
                {order.isExpress ? "Express Order Placed! ⚡" : "Order Confirmed! 🧺"}
              </Text>
              <Text style={styles.heroSubtitle}>
                {order.isExpress
                  ? "Your clothes will be back in 48 hours, priority handled."
                  : "Sit back — your clothes will be freshly returned in 72 hours."}
              </Text>
            </Animated.View>
          </View>

          <Animated.View
            style={{ opacity: contentOpacity, transform: [{ translateY: contentOffset }] }}
          >
            {/* Order ID + service type pill */}
            <View style={styles.orderIdRow}>
              <View style={styles.orderIdBadge}>
                <Ionicons name="receipt-outline" size={13} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.orderIdText}>#{order.id.slice(-8).toUpperCase()}</Text>
              </View>
              <View style={[styles.servicePill, order.isExpress && styles.servicePillExpress]}>
                <Ionicons
                  name={order.isExpress ? "flash" : "time-outline"}
                  size={12}
                  color={order.isExpress ? "#F59E0B" : LaundryTheme.colors.primaryDark}
                />
                <Text style={[styles.servicePillText, order.isExpress && styles.servicePillTextExpress]}>
                  {order.isExpress ? "Express" : "Standard"}
                </Text>
              </View>
            </View>

            {/* Amount paid — big callout */}
            <LinearGradient
              colors={[LaundryTheme.colors.primaryDark, LaundryTheme.colors.primary]}
              style={styles.amountCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.amountLabel}>Amount paid</Text>
              <Text style={styles.amountValue}>{formatNaira(order.paidAmount)}</Text>
              <View style={styles.amountStatusRow}>
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#4ADE80" />
                  <Text style={styles.paidBadgeText}>Paid · Demo</Text>
                </View>
                <Text style={styles.amountTimestamp}>
                  {order.actualDeliveryISO
                    ? formatDateTime(order.actualDeliveryISO)
                    : "Just now"}
                </Text>
              </View>
            </LinearGradient>

            {/* Schedule info grid */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>Pickup & Delivery</Text>
              <View style={styles.infoGrid}>
                <InfoCard
                  icon="car-outline"
                  label="Pickup slot"
                  value={`${getPickupDayLabel(order.pickupDay)} · ${getPickupWindowLabel(order.pickupWindow)}`}
                />
                <InfoCard
                  icon="home-outline"
                  label="Delivery slot"
                  value={
                    order.deliveryDay && order.deliveryWindow
                      ? `${getDeliveryDayLabel(order.deliveryDay)} · ${getDeliveryWindowLabel(order.deliveryWindow)}`
                      : "Standard schedule"
                  }
                />
              </View>
              <View style={styles.infoGrid}>
                <InfoCard
                  icon="alarm-outline"
                  label="Promised by"
                  value={formatDateTime(order.promisedDeliveryISO)}
                />
                <InfoCard
                  icon="location-outline"
                  label="Pickup address"
                  value={order.address ?? "On file"}
                />
              </View>
            </View>

            {/* Delivered items breakdown */}
            {order.lineItems && order.lineItems.length > 0 && (
              <View style={styles.itemsCard}>
                <View style={styles.itemsCardHeader}>
                  <Ionicons name="shirt-outline" size={16} color={LaundryTheme.colors.primaryDark} />
                  <Text style={styles.itemsCardTitle}>Items Cleaned</Text>
                  <Text style={styles.itemsCardCount}>
                    {order.lineItems.reduce((s, i) => s + i.quantity, 0)} pieces
                  </Text>
                </View>
                {order.lineItems.map((item) => (
                  <View key={item.id} style={styles.receiptRow}>
                    <Text style={styles.receiptName}>{item.name}</Text>
                    <Text style={styles.receiptQty}>×{item.quantity}</Text>
                    <Text style={styles.receiptPrice}>{formatNaira(item.unitPrice * item.quantity)}</Text>
                  </View>
                ))}
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptName, { fontWeight: "800" }]}>Total</Text>
                  <Text style={styles.receiptQty} />
                  <Text style={[styles.receiptPrice, { fontSize: 15 }]}>{formatNaira(order.paidAmount)}</Text>
                </View>
              </View>
            )}

            {/* Track order CTA */}
            <SoftPressable
              onPress={() =>
                router.push({ pathname: "/track-order", params: { orderId: order.id } })
              }
              style={styles.trackBtn}
            >
              <Ionicons name="navigate-outline" size={18} color="#fff" />
              <Text style={styles.trackBtnText}>Track My Order</Text>
            </SoftPressable>

            <View style={styles.bottomActions}>
              <SoftPressable
                onPress={() => router.replace("/home")}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostBtnText}>Back to Home</Text>
              </SoftPressable>
              <SoftPressable
                onPress={() => router.replace("/order-history")}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostBtnText}>Order History</Text>
              </SoftPressable>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function InfoCard({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardIcon}>
        <Ionicons name={icon} size={14} color={LaundryTheme.colors.primaryDark} />
      </View>
      <Text style={styles.infoCardLabel}>{label}</Text>
      <Text style={styles.infoCardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { color: LaundryTheme.colors.muted, fontWeight: "600", marginTop: 8 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 24,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 16,
  },
  checkRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(109,40,217,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: LaundryTheme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: LaundryTheme.colors.muted,
    textAlign: "center",
    lineHeight: 22,
    fontSize: 14,
    maxWidth: 300,
  },

  // Order ID row
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  orderIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  orderIdText: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  servicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
  },
  servicePillExpress: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  servicePillText: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    fontSize: 12,
  },
  servicePillTextExpress: { color: "#B45309" },

  // Amount card
  amountCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: LaundryTheme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  amountLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },
  amountValue: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 4,
  },
  amountStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paidBadgeText: { color: "#4ADE80", fontWeight: "700", fontSize: 12 },
  amountTimestamp: { color: "rgba(255,255,255,0.6)", fontSize: 12 },

  // Info section
  infoSection: { marginBottom: 16 },
  infoSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    marginBottom: 10,
  },
  infoGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  infoCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    ...LaundryTheme.shadow.soft,
    gap: 4,
  },
  infoCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  infoCardLabel: { color: LaundryTheme.colors.muted, fontSize: 11, fontWeight: "700" },
  infoCardValue: {
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  // Items breakdown
  itemsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 16,
    marginBottom: 20,
    ...LaundryTheme.shadow.soft,
  },
  itemsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  itemsCardTitle: {
    flex: 1,
    fontWeight: "800",
    fontSize: 15,
    color: LaundryTheme.colors.ink,
  },
  itemsCardCount: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "700",
    fontSize: 13,
  },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#F4EDFF",
  },
  receiptName: { flex: 1, color: LaundryTheme.colors.ink, fontSize: 13, fontWeight: "600" },
  receiptQty: { color: LaundryTheme.colors.muted, fontSize: 13, marginRight: 16, minWidth: 24 },
  receiptPrice: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    fontSize: 13,
  },
  receiptDivider: { height: 1, backgroundColor: LaundryTheme.colors.primarySoft, marginVertical: 4 },

  // Buttons
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: LaundryTheme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  trackBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  bottomActions: { flexDirection: "row", gap: 10, marginBottom: 8 },
  ghostBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#fff",
    ...LaundryTheme.shadow.soft,
  },
  ghostBtnText: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    fontSize: 13,
  },

  // Empty state
  emptyTitle: { fontSize: 18, fontWeight: "800", color: LaundryTheme.colors.ink },
  emptyBody: { color: LaundryTheme.colors.muted, textAlign: "center" },
  homeBtn: {
    marginTop: 8,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  homeBtnText: { color: "#fff", fontWeight: "800" },
});
