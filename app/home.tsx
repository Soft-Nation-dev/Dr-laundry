import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getHomeDashboard, HomeDashboard } from "@/lib/home-api";
import { formatDateTime, formatNaira, getOrderStatusLabel } from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type HomeAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const homeActions: HomeAction[] = [
  { label: "Pickup", icon: "calendar-outline", route: "/pickup-dates" },
  { label: "History", icon: "receipt-outline", route: "/order-history" },
  { label: "Track", icon: "navigate-outline", route: "/track-order" },
  { label: "Price List", icon: "shirt-outline", route: "/new-order" },
  { label: "Pay", icon: "card-outline", route: "/payment" },
  { label: "Express", icon: "flash-outline", route: "/membership" },
  { label: "Support", icon: "chatbubbles-outline", route: "/support" },
  { label: "Profile", icon: "person-outline", route: "/profile" },
];

const EMPTY_DASHBOARD: HomeDashboard = {
  profileName: "",
  nextOrder: null,
  latestActiveOrderId: null,
  inProcess: 0,
  delivered: 0,
  pendingAmount: 0,
  unreadNotifications: 0,
};

function getFirstName(value: unknown) {
  if (typeof value !== "string") return "there";
  const names = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const selected = names[0];
  if (!selected) return "there";
  return (
    selected.charAt(0).toLocaleUpperCase() +
    selected.slice(1).toLocaleLowerCase()
  );
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
  const headerIn = useRef(new Animated.Value(0)).current;
  const statusIn = useRef(new Animated.Value(0)).current;
  const servicesIn = useRef(new Animated.Value(0)).current;
  const overviewIn = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;

  const userName = useMemo(
    () => getFirstName(dashboard.profileName),
    [dashboard.profileName],
  );

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
          toValue: 0.5,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 950,
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
      // Focus refresh and pull-to-refresh remain available if realtime fails.
    });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

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

  const openAction = (item: HomeAction) => {
    if (item.label === "Track" && dashboard.latestActiveOrderId) {
      router.push({
        pathname: "/track-order",
        params: { orderId: dashboard.latestActiveOrderId },
      });
      return;
    }
    router.push(item.route as never);
  };

  const statusLabel = dashboard.nextOrder
    ? dashboard.nextOrder.status === "pickup-confirmed"
      ? "Next pickup"
      : "Active order"
    : "Laundry, on your time";
  const statusTitle = dashboard.nextOrder
    ? dashboard.nextOrder.status === "pickup-confirmed"
      ? formatDateTime(dashboard.nextOrder.pickupAtISO)
      : getOrderStatusLabel(dashboard.nextOrder.status)
    : "Schedule a pickup";
  const statusChip = dashboard.nextOrder
    ? dashboard.nextOrder.status === "pickup-confirmed"
      ? "Pickup confirmed"
      : getOrderStatusLabel(dashboard.nextOrder.status)
    : "Get started";

  return (
    <LinearGradient
      colors={[LaundryTheme.colors.bgStart, "#FFFFFF", LaundryTheme.colors.bgEnd]}
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
          <Animated.View style={[styles.headerRow, entranceStyle(headerIn, 10)]}>
            <View style={styles.brandBlock}>
              <Image
                source={require("@/assets/images/logo.jpeg")}
                style={styles.logo}
                contentFit="cover"
              />
              <View>
                <Text style={styles.kicker}>Dr Laundry</Text>
                <Text style={styles.title}>Hi {userName}</Text>
              </View>
            </View>
            <View style={styles.headerPills}>
              <SoftPressable
                onPress={() => router.push("/notifications" as never)}
                style={styles.iconPill}
                accessibilityLabel="Open notifications"
              >
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={LaundryTheme.colors.ink}
                />
                {dashboard.unreadNotifications > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {Math.min(dashboard.unreadNotifications, 9)}
                    </Text>
                  </View>
                ) : null}
              </SoftPressable>
              <SoftPressable
                onPress={() => router.push("/settings" as never)}
                style={styles.avatar}
                accessibilityLabel="Open settings"
              >
                <Ionicons name="settings-outline" size={19} color="#FFFFFF" />
              </SoftPressable>
            </View>
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

          <Animated.View style={entranceStyle(statusIn)}>
            <SoftPressable onPress={openStatus} style={styles.statusCard}>
              <View style={styles.statusOrbLarge} />
              <View style={styles.statusOrbSmall} />
              <View style={styles.statusTopRow}>
                <Text style={styles.statusLabel}>{statusLabel}</Text>
                {dashboard.nextOrder ? (
                  <View style={styles.liveWrap}>
                    <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.statusMainRow}>
                <View style={styles.statusCopy}>
                  {isLoading ? (
                    <ActivityIndicator
                      style={styles.statusLoader}
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.statusTime}>{statusTitle}</Text>
                  )}
                  <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>{statusChip}</Text>
                  </View>
                </View>
                <View style={styles.statusArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </View>
            </SoftPressable>
          </Animated.View>

          <Animated.View style={entranceStyle(servicesIn)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Services</Text>
              <Text style={styles.sectionHint}>Everything in one place</Text>
            </View>
            <View style={styles.grid}>
              {homeActions.map((item) => (
                <SoftPressable
                  key={item.label}
                  onPress={() => openAction(item)}
                  style={styles.actionTile}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons
                      name={item.icon}
                      size={23}
                      color={LaundryTheme.colors.primaryDark}
                    />
                  </View>
                  <Text style={styles.actionLabel}>{item.label}</Text>
                </SoftPressable>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={entranceStyle(overviewIn)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <Text style={styles.sectionHint}>Your laundry at a glance</Text>
            </View>
            <View style={styles.quickRow}>
              <View style={styles.quickCard}>
                <Ionicons name="cube-outline" size={20} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.quickValue}>{isLoading ? "—" : dashboard.inProcess}</Text>
                <Text style={styles.quickLabel}>In Process</Text>
              </View>
              <View style={styles.quickCard}>
                <Ionicons name="checkmark-circle-outline" size={20} color={LaundryTheme.colors.success} />
                <Text style={styles.quickValue}>{isLoading ? "—" : dashboard.delivered}</Text>
                <Text style={styles.quickLabel}>Delivered</Text>
              </View>
              <View style={styles.quickCard}>
                <Ionicons name="wallet-outline" size={20} color={LaundryTheme.colors.warning} />
                <Text style={[styles.quickValue, styles.quickValueSmall]}>
                  {isLoading ? "—" : formatNaira(dashboard.pendingAmount)}
                </Text>
                <Text style={styles.quickLabel}>Pending</Text>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 28,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  logo: { width: 43, height: 43, borderRadius: 14 },
  kicker: { fontSize: 12, color: LaundryTheme.colors.primaryDark, fontWeight: "800", letterSpacing: 0.3 },
  title: { marginTop: 2, fontSize: 21, fontWeight: "800", color: LaundryTheme.colors.ink, letterSpacing: -0.4 },
  headerPills: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconPill: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LaundryTheme.colors.border, ...LaundryTheme.shadow.soft },
  notificationBadge: { position: "absolute", right: -4, top: -4, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.danger, borderWidth: 2, borderColor: "#FFFFFF" },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: LaundryTheme.colors.primary, justifyContent: "center", alignItems: "center", ...LaundryTheme.shadow.soft },
  errorStrip: { marginTop: 14, minHeight: 48, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFF3F5", borderWidth: 1, borderColor: "#FFD9E1" },
  errorText: { flex: 1, color: "#7D3448", fontSize: 11, lineHeight: 15 },
  retryText: { color: "#9B3651", fontSize: 11, fontWeight: "900" },
  statusCard: { marginTop: 18, borderRadius: 24, padding: 18, minHeight: 154, backgroundColor: LaundryTheme.colors.primary, overflow: "hidden", ...LaundryTheme.shadow.strong },
  statusOrbLarge: { position: "absolute", width: 150, height: 150, borderRadius: 75, right: -48, top: -70, backgroundColor: "rgba(255,255,255,0.08)" },
  statusOrbSmall: { position: "absolute", width: 76, height: 76, borderRadius: 38, right: 54, bottom: -52, backgroundColor: "rgba(255,255,255,0.06)" },
  statusTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusLabel: { color: "#E8DBFF", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  liveWrap: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 8, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#67F5C4" },
  liveText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  statusMainRow: { flex: 1, marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  statusCopy: { flex: 1 },
  statusTime: { color: "#FFFFFF", fontSize: 20, lineHeight: 25, fontWeight: "800" },
  statusLoader: { alignSelf: "flex-start", marginVertical: 8 },
  statusChip: { marginTop: 12, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusChipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  statusArrow: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  sectionHeader: { marginTop: 22, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { color: LaundryTheme.colors.ink, fontSize: 15, fontWeight: "800" },
  sectionHint: { color: LaundryTheme.colors.muted, fontSize: 10 },
  grid: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" },
  actionTile: { width: "23%", alignItems: "center", paddingVertical: 7, paddingHorizontal: 2, marginBottom: 11, minHeight: 88 },
  actionIconWrap: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LaundryTheme.colors.border, ...LaundryTheme.shadow.soft },
  actionLabel: { marginTop: 7, fontSize: 10.5, color: LaundryTheme.colors.ink, fontWeight: "700", textAlign: "center", lineHeight: 14 },
  quickRow: { marginTop: 11, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  quickCard: { flex: 1, minHeight: 108, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 14, borderWidth: 1, borderColor: LaundryTheme.colors.border, ...LaundryTheme.shadow.soft },
  quickValue: { marginTop: 8, fontWeight: "800", color: LaundryTheme.colors.ink, fontSize: 16 },
  quickValueSmall: { fontSize: 12 },
  quickLabel: { marginTop: 3, color: LaundryTheme.colors.muted, fontSize: 10 },
});
