import { SoftPressable } from "@/components/soft-pressable";
import { AppHeader } from "@/components/app-header";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getHomeDashboard, HomeDashboard } from "@/lib/home-api";
import { formatDateTime, formatNaira, getOrderStatusLabel } from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EMPTY_DASHBOARD: HomeDashboard = {
  profileName: "",
  nextOrder: null,
  latestActiveOrderId: null,
  inProcess: 0,
  delivered: 0,
  pendingAmount: 0,
  pendingPaymentCount: 0,
  pendingPaymentExpiresAt: null,
  unreadNotifications: 0,
};

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function entranceStyle(value: Animated.Value, offset = 14) {
  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [offset, 0],
        }),
      },
    ],
  };
}

export default function HomeScreen() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pendingSeconds, setPendingSeconds] = useState(0);
  const handledExpiryRef = useRef<string | null>(null);

  const headerIn = useRef(new Animated.Value(0)).current;
  const statusIn = useRef(new Animated.Value(0)).current;
  const servicesIn = useRef(new Animated.Value(0)).current;
  const overviewIn = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;

  const runEntrance = useCallback(() => {
    [headerIn, statusIn, servicesIn, overviewIn].forEach((value) =>
      value.setValue(0),
    );
    Animated.stagger(70, [headerIn, statusIn, servicesIn, overviewIn].map(
      (value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
    )).start();
  }, [headerIn, overviewIn, servicesIn, statusIn]);

  const loadDashboard = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError("");
    try {
      const result = await getHomeDashboard();
      setDashboard(result);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not refresh your home.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      runEntrance();
    }, [loadDashboard, runEntrance]),
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [livePulse]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      const topic = `customer-home-${data.user.id}`;
      const existingChannels = supabase
        .getChannels()
        .filter((item) => item.topic === `realtime:${topic}`);
      await Promise.all(
        existingChannels.map((item) => supabase.removeChannel(item)),
      );
      if (!active) return;

      const nextChannel = supabase.channel(topic);
      nextChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${data.user.id}`,
        },
        () => loadDashboard(),
      );
      nextChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${data.user.id}`,
        },
        () => loadDashboard(),
      );
      channel = nextChannel;
      nextChannel.subscribe();
    }).catch(() => {
      // Realtime fallback
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const expiry = dashboard.pendingPaymentExpiresAt;
    if (!expiry) {
      setPendingSeconds(0);
      handledExpiryRef.current = null;
      return;
    }
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 1000));
      setPendingSeconds(seconds);
      if (seconds === 0 && handledExpiryRef.current !== expiry) {
        handledExpiryRef.current = expiry;
        void loadDashboard();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [dashboard.pendingPaymentExpiresAt, loadDashboard]);

  const openStatus = () => {
    if (dashboard.nextOrder) {
      router.push({
        pathname: "/track-order",
        params: { orderId: dashboard.nextOrder.id },
      });
    } else {
      router.push("/new-order");
    }
  };

  const statusTitle = dashboard.nextOrder
    ? dashboard.nextOrder.status === "pickup-confirmed"
      ? formatDateTime(dashboard.nextOrder.pickupAtISO)
      : getOrderStatusLabel(dashboard.nextOrder.status)
    : "No pickup scheduled";

  const statusChip = dashboard.nextOrder
    ? dashboard.nextOrder.status === "pickup-confirmed"
      ? "Pickup confirmed"
      : getOrderStatusLabel(dashboard.nextOrder.status)
    : "Book a service";

  const pendingAmountDisplay = dashboard.pendingAmount > 0
    ? formatNaira(dashboard.pendingAmount)
    : formatNaira(0);

  return (
    <LinearGradient
      colors={["#F4EEFC", "#ECE5F8", "#E8DFFA"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadDashboard(true)}
              tintColor={LaundryTheme.colors.primary}
              colors={[LaundryTheme.colors.primary]}
            />
          }
        >
          {/* Shared Header Component */}
          <Animated.View style={entranceStyle(headerIn, 10)}>
            <AppHeader unreadCount={dashboard.unreadNotifications} inSafeArea={false} />
          </Animated.View>

          {loadError ? (
            <SoftPressable
              onPress={() => loadDashboard()}
              style={styles.errorStrip}
            >
              <Ionicons name="cloud-offline-outline" size={17} color="#9B3651" />
              <Text numberOfLines={2} style={styles.errorText}>{loadError}</Text>
              <Text style={styles.retryText}>Retry</Text>
            </SoftPressable>
          ) : null}

          {/* NEXT PICKUP Hero Banner */}
          <Animated.View style={entranceStyle(statusIn)}>
            <SoftPressable onPress={openStatus} style={styles.heroCard}>
              <LinearGradient
                colors={["#3D0B6B", "#4A1184", "#5C16A3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              >
                {/* Decorative background circles */}
                <View style={styles.decorCircleLarge} />
                <View style={styles.decorCircleSmall} />

                {/* Top Row: Label & LIVE Badge */}
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroLabel}>NEXT PICKUP</Text>
                  <View style={styles.liveWrap}>
                    <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>

                {/* Middle: Date/Time */}
                <View style={styles.heroMiddleRow}>
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" style={{ alignSelf: "flex-start", marginVertical: 6 }} />
                  ) : (
                    <Text style={styles.heroDateText}>{statusTitle}</Text>
                  )}
                </View>

                {/* Bottom Row: Status Chip & Arrow Button */}
                <View style={styles.heroBottomRow}>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{statusChip}</Text>
                  </View>

                  <View style={styles.heroArrowBtn}>
                    <Ionicons name="chevron-forward" size={20} color={LaundryTheme.colors.primaryDark} />
                  </View>
                </View>
              </LinearGradient>
            </SoftPressable>
          </Animated.View>

          {/* Services Section */}
          <Animated.View style={entranceStyle(servicesIn)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Services</Text>
              <Text style={styles.sectionHint}>Everything in one place</Text>
            </View>

            {/* Row 1: Top 3 Main Service Cards matching step 1 */}
            <View style={styles.serviceRowMain}>
              <SoftPressable
                onPress={() => router.push({ pathname: "/new-order", params: { mode: "wash-iron" } })}
                style={styles.serviceCardMain}
              >
                <View style={styles.illustrationWrap}>
                  <Image
                    source={require("@/assets/images/wash_and_fold.png")}
                    style={styles.serviceImage}
                    contentFit="contain"
                  />
                </View>
                <Text style={styles.serviceTitleMain}>Washing +{"\n"}Ironing</Text>
              </SoftPressable>

              <SoftPressable
                onPress={() => router.push({ pathname: "/new-order", params: { mode: "ironing-only" } })}
                style={styles.serviceCardMain}
              >
                <View style={styles.illustrationWrap}>
                  <Image
                    source={require("@/assets/images/ironing.png")}
                    style={styles.serviceImage}
                    contentFit="contain"
                  />
                </View>
                <Text style={styles.serviceTitleMain}>Ironing{"\n"}Only</Text>
              </SoftPressable>

              <SoftPressable
                onPress={() => router.push({ pathname: "/new-order", params: { mode: "washing-only" } })}
                style={styles.serviceCardMain}
              >
                <View style={styles.illustrationWrap}>
                  <Image
                    source={require("@/assets/images/dry_clean.png")}
                    style={styles.serviceImage}
                    contentFit="contain"
                  />
                </View>
                <Text style={styles.serviceTitleMain}>Washing{"\n"}Only</Text>
              </SoftPressable>

              <SoftPressable
                onPress={() => router.push({ pathname: "/new-order", params: { mode: "wash-iron", express: "true" } })}
                style={[styles.serviceCardMain, styles.serviceCardExpress]}
              >
                <View style={[styles.illustrationWrap, styles.illustrationWrapExpress]}>
                  <Image
                    source={require("@/assets/images/express_service.png")}
                    style={styles.serviceImage}
                    contentFit="contain"
                  />
                </View>
                <Text style={[styles.serviceTitleMain, styles.serviceTitleExpress]}>Express{"\n"}24h</Text>
              </SoftPressable>
            </View>

            {/* Row 2: Bottom 4 Secondary Feature Tiles */}
            <View style={styles.serviceRowSecondary}>
              <SoftPressable
                onPress={() => router.push("/payment-history" as never)}
                style={styles.serviceTileSecondary}
              >
                <Ionicons name="wallet-outline" size={24} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.serviceTitleSecondary}>Payments</Text>
              </SoftPressable>

              <SoftPressable
                onPress={() => router.push("/support" as never)}
                style={styles.serviceTileSecondary}
              >
                <Ionicons name="pricetag-outline" size={22} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.serviceTitleSecondary}>Support</Text>
              </SoftPressable>

              <SoftPressable
                onPress={() => router.push("/support" as never)}
                style={styles.serviceTileSecondary}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.serviceTitleSecondary}>Chater</Text>
              </SoftPressable>

              <SoftPressable
                onPress={() => router.push("/profile" as never)}
                style={styles.serviceTileSecondary}
              >
                <Ionicons name="headset-outline" size={22} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.serviceTitleSecondary}>Profile</Text>
              </SoftPressable>
            </View>
          </Animated.View>

          {/* Overview Section */}
          <Animated.View style={entranceStyle(overviewIn)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <Text style={styles.sectionHint}>Your laundry at a glance</Text>
            </View>

            <View style={styles.overviewGrid}>
              {/* Left Card: In Process */}
              <View style={styles.inProcessCard}>
                <Ionicons name="cube-outline" size={26} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.inProcessNumber}>
                  {isLoading ? "—" : dashboard.inProcess}
                </Text>
                <Text style={styles.inProcessLabel}>In Process</Text>
              </View>

              {/* Right Card: Pending Payments & PAY NOW */}
              <View style={styles.pendingCard}>
                <View style={styles.pendingTopRow}>
                  <SoftPressable
                    accessibilityRole="button"
                    accessibilityLabel="Open payment history"
                    onPress={() => router.push("/payment-history" as never)}
                    style={styles.pendingReceiptButton}
                  >
                    <Ionicons name="receipt-outline" size={23} color={LaundryTheme.colors.primaryDark} />
                  </SoftPressable>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.pendingAmountText}>
                      {isLoading ? "—" : pendingAmountDisplay}
                    </Text>
                    <Text style={styles.pendingLabel}>Pending Payments</Text>
                  </View>
                </View>

                <Text style={styles.pendingTimerText}>
                  {dashboard.pendingPaymentCount > 0
                    ? `Auto-cancels in ${formatCountdown(pendingSeconds)}`
                    : "No payment awaiting checkout"}
                </Text>

                {/* PAY NOW CTA Button */}
                <SoftPressable
                  onPress={() => router.push("/payment-history" as never)}
                  style={styles.payNowBtn}
                >
                  <Text style={styles.payNowText}>
                    {dashboard.pendingPaymentCount > 0 ? "PAY NOW" : "VIEW HISTORY"}
                  </Text>
                </SoftPressable>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 40,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatarBorder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: "#3D0B6B",
    padding: 2,
    backgroundColor: "#FFFFFF",
  },
  logo: { width: "100%", height: "100%", borderRadius: 20 },
  kicker: { fontSize: 13, color: LaundryTheme.colors.muted, fontWeight: "600" },
  title: { marginTop: 1, fontSize: 22, fontWeight: "900", color: LaundryTheme.colors.ink, letterSpacing: -0.4 },
  headerPills: { flexDirection: "row", alignItems: "center", gap: 10 },
  bellPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    ...LaundryTheme.shadow.soft,
  },
  notificationBadge: {
    position: "absolute",
    right: 2,
    top: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LaundryTheme.colors.danger,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  settingsPill: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: LaundryTheme.colors.primaryDark,
    justifyContent: "center",
    alignItems: "center",
    ...LaundryTheme.shadow.soft,
  },

  // Error Strip
  errorStrip: {
    marginBottom: 14,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF3F5",
    borderWidth: 1,
    borderColor: "#FFD9E1",
  },
  errorText: { flex: 1, color: "#7D3448", fontSize: 12 },
  retryText: { color: "#9B3651", fontSize: 12, fontWeight: "900" },

  // Hero Banner Card
  heroCard: {
    marginBottom: 20,
    borderRadius: 26,
    overflow: "hidden",
    ...LaundryTheme.shadow.strong,
  },
  heroGradient: {
    padding: 22,
    minHeight: 160,
    justifyContent: "space-between",
  },
  decorCircleLarge: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -40,
    top: -60,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  decorCircleSmall: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    right: 30,
    bottom: -40,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  liveWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#4ADE80",
  },
  liveText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  heroMiddleRow: {
    marginVertical: 10,
  },
  heroDateText: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  heroArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...LaundryTheme.shadow.soft,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: LaundryTheme.colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionHint: {
    color: LaundryTheme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },

  // Services Grid
  serviceRowMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  serviceCardMain: {
    width: "23.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 110,
    borderWidth: 1,
    borderColor: "rgba(230, 220, 250, 0.6)",
    ...LaundryTheme.shadow.soft,
  },
  illustrationWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  serviceImage: {
    width: 48,
    height: 48,
  },
  serviceTitleMain: {
    fontSize: 11,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    textAlign: "center",
    lineHeight: 14,
  },
  serviceCardExpress: {
    borderColor: "rgba(76, 16, 125, 0.3)",
    borderWidth: 1.5,
    backgroundColor: "rgba(244, 238, 252, 0.9)",
  },
  illustrationWrapExpress: {
    backgroundColor: "rgba(76, 16, 125, 0.08)",
  },
  serviceTitleExpress: {
    color: LaundryTheme.colors.primaryDark,
  },

  serviceRowSecondary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  serviceTileSecondary: {
    width: "23.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: "rgba(230, 220, 250, 0.8)",
    ...LaundryTheme.shadow.soft,
  },
  serviceTitleSecondary: {
    marginTop: 6,
    fontSize: 11.5,
    fontWeight: "700",
    color: LaundryTheme.colors.ink,
    textAlign: "center",
  },

  // Overview Section Grid
  overviewGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  inProcessCard: {
    width: "36%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 130,
    borderWidth: 1,
    borderColor: "rgba(230, 220, 250, 0.6)",
    ...LaundryTheme.shadow.soft,
  },
  inProcessNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    marginVertical: 4,
  },
  inProcessLabel: {
    fontSize: 12,
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
  },

  pendingCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 130,
    borderWidth: 1,
    borderColor: "rgba(230, 220, 250, 0.6)",
    ...LaundryTheme.shadow.soft,
  },
  pendingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pendingReceiptButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  pendingAmountText: {
    fontSize: 22,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.5,
  },
  pendingLabel: {
    fontSize: 11,
    color: LaundryTheme.colors.muted,
    fontWeight: "600",
    marginTop: 2,
  },
  pendingTimerText: {
    marginTop: 7,
    color: LaundryTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
  },
  payNowBtn: {
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    ...LaundryTheme.shadow.soft,
  },
  payNowText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
