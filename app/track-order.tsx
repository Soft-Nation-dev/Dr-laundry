import { LiveOrderMap } from "@/components/live-order-map";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getOrderById } from "@/lib/order-storage";
import { formatDateTime, getOrderStatusLabel, hoursUntil } from "@/lib/pricing";
import { OrderRecord, OrderStatus } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

type TimelineRow = {
  title: string;
  time: string;
  done: boolean;
};

function statusRank(status: OrderStatus): number {
  switch (status) {
    case "pickup-confirmed":
      return 1;
    case "processing":
      return 2;
    case "ready-for-delivery":
      return 3;
    case "out-for-delivery":
      return 4;
    case "delivered":
      return 5;
    default:
      return 0;
  }
}

function timelineFor(order: OrderRecord): TimelineRow[] {
  const rank = statusRank(order.status);

  return [
    {
      title: "Pickup confirmed",
      time: formatDateTime(order.pickupAtISO),
      done: rank >= 1,
    },
    {
      title: "Laundry sorted at hub",
      time: rank >= 2 ? "In progress" : "Pending",
      done: rank >= 2,
    },
    {
      title: "Delivery confirmed",
      time: order.deliveryConfirmedAt ? formatDateTime(order.deliveryConfirmedAt) : rank >= 3 ? "Choose a convenient slot" : "Pending",
      done: rank >= 3,
    },
    {
      title: "Out for delivery",
      time: rank >= 4 ? "On route" : "Pending",
      done: rank >= 4,
    },
    {
      title: "Delivered",
      time:
        rank >= 5 && order.actualDeliveryISO
          ? formatDateTime(order.actualDeliveryISO)
          : "Pending",
      done: rank >= 5,
    },
  ];
}

export default function TrackOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);

  const introOpacity = useRef(new Animated.Value(0)).current;
  const introOffset = useRef(new Animated.Value(16)).current;
  const cardScale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
      }),
      Animated.timing(introOffset, {
        toValue: 0,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }),
    ]).start();
  }, [cardScale, introOffset, introOpacity]);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        setLoadingOrder(false);
        return;
      }

      const result = await getOrderById(orderId);
      setOrder(result);
      setLoadingOrder(false);
    };

    loadOrder();
  }, [orderId]);

  const timeline = useMemo(() => {
    if (!order) {
      return [];
    }
    return timelineFor(order);
  }, [order]);

  const etaHours = order ? hoursUntil(order.promisedDeliveryISO) : 0;

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
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View
            style={[
              styles.headerBlock,
              {
                opacity: introOpacity,
                transform: [{ translateY: introOffset }],
              },
            ]}
          >
            <View>
              <Text style={styles.kicker}>Order tracking</Text>
              <Text style={styles.title}>Track order</Text>
              <Text style={styles.subtitle}>
                Monitor each stage from pickup confirmation to final delivery.
              </Text>
            </View>
            <View style={styles.floatingCard}>
              <Text style={styles.floatingLabel}>ETA</Text>
              <Text style={styles.floatingValue}>{etaHours}h</Text>
            </View>
          </Animated.View>

          {loadingOrder ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={LaundryTheme.colors.primaryDark} />
              <Text style={styles.loadingText}>Loading order timeline...</Text>
            </View>
          ) : order ? (
            <>
              <Animated.View style={{ opacity: introOpacity, transform: [{ translateY: introOffset }] }}>
                <LiveOrderMap orderId={order.id} height={330} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.statusBanner,
                  {
                    opacity: introOpacity,
                    transform: [
                      { translateY: introOffset },
                      { scale: cardScale },
                    ],
                  },
                ]}
              >
                <View style={styles.statusTopRow}>
                  <View>
                    <Text style={styles.bannerLabel}>Order</Text>
                    <Text style={styles.bannerTitle}>{order.id}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Ionicons name="time-outline" size={14} color="#fff" />
                    <Text style={styles.badgeText}>
                      {getOrderStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bannerText}>
                  Promised return: {formatDateTime(order.promisedDeliveryISO)}
                </Text>
                <View style={styles.bannerProgressTrack}>
                  <View
                    style={[
                      styles.bannerProgressFill,
                      { width: `${statusRank(order.status) * 20}%` },
                    ]}
                  />
                </View>
              </Animated.View>

              {order.status === "ready-for-delivery" && order.deliveryConfirmationStatus !== "confirmed" ? (
                <SoftPressable
                  onPress={() => router.push({ pathname: "/confirm-delivery", params: { orderId: order.id } } as never)}
                  style={styles.deliveryAction}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliveryActionTitle}>Choose your delivery slot</Text>
                    <Text style={styles.deliveryActionBody}>Confirm the date, time window and receiving address before dispatch.</Text>
                  </View>
                  <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
                </SoftPressable>
              ) : null}

              <Animated.View
                style={[
                  styles.timelineWrap,
                  {
                    opacity: introOpacity,
                    transform: [
                      { translateY: introOffset },
                      { scale: cardScale },
                    ],
                  },
                ]}
              >
                <Text style={styles.section}>Journey timeline</Text>
                {timeline.map((item, index) => (
                  <View key={item.title} style={styles.timelineRow}>
                    <View style={[styles.dot, item.done && styles.dotDone]} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemTime}>{item.time}</Text>
                    </View>
                    {index < timeline.length - 1 ? (
                      <View style={styles.line} />
                    ) : null}
                  </View>
                ))}
              </Animated.View>
            </>
          ) : (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingText}>
                No order found for tracking.
              </Text>
            </View>
          )}
        </ScrollView>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingTop: 14,
    paddingHorizontal: 22,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 86,
  },
  headerBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: 1.6,
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    fontSize: 11,
    marginBottom: 8,
  },
  title: {
    fontSize: 31,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 8,
    color: LaundryTheme.colors.muted,
    lineHeight: 21,
    maxWidth: 270,
  },
  floatingCard: {
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  floatingLabel: {
    color: "#E8DBFF",
    fontSize: 12,
    fontWeight: "700",
  },
  floatingValue: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 4,
  },
  statusBanner: {
    marginTop: 24,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 24,
    padding: 16,
    ...LaundryTheme.shadow.strong,
  },
  statusTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerLabel: {
    color: "#E8DBFF",
    fontSize: 12,
    fontWeight: "700",
  },
  bannerTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },
  bannerText: {
    marginTop: 12,
    color: "#E8DBFF",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  bannerProgressTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  bannerProgressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  timelineWrap: {
    marginTop: 22,
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 16,
    ...LaundryTheme.shadow.soft,
  },
  deliveryAction: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#087A58",
    ...LaundryTheme.shadow.soft,
  },
  deliveryActionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  deliveryActionBody: { color: "#D8F5E9", fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  section: {
    marginBottom: 12,
    color: LaundryTheme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    position: "relative",
    paddingBottom: 20,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 10,
    backgroundColor: "#D7CCEF",
    marginTop: 4,
  },
  dotDone: {
    backgroundColor: LaundryTheme.colors.success,
  },
  timelineContent: {
    marginLeft: 12,
    flex: 1,
  },
  itemTitle: {
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
  },
  itemTime: {
    marginTop: 2,
    color: LaundryTheme.colors.muted,
    fontSize: 13,
  },
  line: {
    position: "absolute",
    left: 6,
    top: 20,
    width: 2,
    bottom: 6,
    backgroundColor: "#E7DEF9",
  },
  loadingCard: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 16,
    gap: 10,
    alignItems: "center",
  },
  loadingText: {
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
  },
});
