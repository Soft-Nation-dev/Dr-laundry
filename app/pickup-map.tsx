import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getOrderById } from "@/lib/order-storage";
import { formatDateTime, hoursUntil } from "@/lib/pricing";
import { OrderRecord } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    StyleSheet,
    Text,
    View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

type Point = { latitude: number; longitude: number };

const fallbackUser: Point = { latitude: 6.5244, longitude: 3.3792 };

export default function PickupMapScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [userLocation, setUserLocation] = useState<Point>(fallbackUser);
  const [progress, setProgress] = useState(0.15);

  const eta = Math.max(2, Math.round((1 - progress) * 14));
  const promisedHours = order ? hoursUntil(order.promisedDeliveryISO) : 0;

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerOffset = useRef(new Animated.Value(16)).current;
  const sheetRise = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const requestLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    };

    requestLocation();
  }, []);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        setLoadingOrder(false);
        return;
      }

      const currentOrder = await getOrderById(orderId);
      setOrder(currentOrder);
      setLoadingOrder(false);
    };

    loadOrder();
  }, [orderId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.015;
        return next > 1 ? 1 : next;
      });
    }, 350);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
      }),
      Animated.timing(headerOffset, {
        toValue: 0,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(sheetRise, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }),
    ]).start();
  }, [headerOffset, headerOpacity, sheetRise]);

  const simulatedRoute = useMemo<Point[]>(() => {
    return [
      { latitude: userLocation.latitude + 0.018, longitude: userLocation.longitude - 0.014 },
      { latitude: userLocation.latitude + 0.018, longitude: userLocation.longitude - 0.004 },
      { latitude: userLocation.latitude + 0.008, longitude: userLocation.longitude - 0.004 },
      { latitude: userLocation.latitude + 0.008, longitude: userLocation.longitude },
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
    ];
  }, [userLocation]);

  const riderLocation = useMemo(() => {
    if (simulatedRoute.length === 0) return userLocation;
    if (simulatedRoute.length === 1) return simulatedRoute[0];
    if (progress <= 0) return simulatedRoute[0];
    if (progress >= 1) return simulatedRoute[simulatedRoute.length - 1];

    const totalSegments = simulatedRoute.length - 1;
    const segmentProgress = progress * totalSegments;
    const segmentIndex = Math.floor(segmentProgress);
    const localProgress = segmentProgress - segmentIndex;

    const startPoint = simulatedRoute[segmentIndex];
    const endPoint = simulatedRoute[segmentIndex + 1];

    return {
      latitude: startPoint.latitude + (endPoint.latitude - startPoint.latitude) * localProgress,
      longitude: startPoint.longitude + (endPoint.longitude - startPoint.longitude) * localProgress,
    };
  }, [simulatedRoute, progress, userLocation]);

  const pickupLabel = order
    ? order.isExpress
      ? "Immediate pickup"
      : formatDateTime(order.pickupAtISO)
    : "--";

  const promiseLabel = order ? formatDateTime(order.promisedDeliveryISO) : "--";

  return (
    <LinearGradient
      colors={["#FBF9FF", "#FFFFFF", LaundryTheme.colors.primarySoft]}
      style={styles.container}
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerOffset }],
            },
          ]}
        >
          <View>
            <Text style={styles.kicker}>Live pickup tracking</Text>
            <Text style={styles.title}>Rider En Route</Text>
            <Text style={styles.subtitle}>
              Pickup is active. Follow movement and review your return promise.
            </Text>
          </View>
          <View style={styles.etaBadge}>
            <Text style={styles.etaBadgeText}>{eta} min ETA</Text>
          </View>
        </Animated.View>

        <View style={styles.mapFrame}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
          >
            <Marker coordinate={userLocation} title="Pickup location">
              <Ionicons
                name="home"
                size={24}
                color={LaundryTheme.colors.primaryDark}
              />
            </Marker>

            <Marker coordinate={riderLocation} title="Rider">
              <Ionicons
                name="car-sport"
                size={28}
                color={LaundryTheme.colors.success}
              />
            </Marker>

            <Polyline
              coordinates={simulatedRoute}
              strokeColor={LaundryTheme.colors.primary}
              strokeWidth={4}
            />
          </MapView>
        </View>

        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: sheetRise }] },
          ]}
        >
          {loadingOrder ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={LaundryTheme.colors.primaryDark} />
              <Text style={styles.loadingText}>Loading order details...</Text>
            </View>
          ) : order ? (
            <>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Pickup progress</Text>
                <Text style={styles.progressValue}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(progress * 100)}%` },
                  ]}
                />
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Pickup</Text>
                  <Text style={styles.metricValue}>{pickupLabel}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Promised return</Text>
                  <Text style={styles.metricValue}>{promiseLabel}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Countdown</Text>
                  <Text style={styles.metricValue}>{promisedHours}h left</Text>
                </View>
              </View>

              <SoftPressable
                onPress={() =>
                  router.push({
                    pathname: "/track-order",
                    params: { orderId: order.id },
                  })
                }
                style={styles.trackButton}
              >
                <Text style={styles.trackText}>Go to Full Order Tracking</Text>
              </SoftPressable>
            </>
          ) : (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>No active order found</Text>
              <Text style={styles.emptyBody}>
                Create a new order to start pickup tracking.
              </Text>
              <SoftPressable
                onPress={() => router.replace("/new-order")}
                style={styles.trackButton}
              >
                <Text style={styles.trackText}>Create Order</Text>
              </SoftPressable>
            </View>
          )}
        </Animated.View>
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
  header: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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
    color: LaundryTheme.colors.ink,
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    color: LaundryTheme.colors.muted,
    maxWidth: 280,
    lineHeight: 21,
  },
  etaBadge: {
    backgroundColor: LaundryTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  etaBadgeText: {
    color: "#fff",
    fontWeight: "800",
  },
  mapFrame: {
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    ...LaundryTheme.shadow.soft,
  },
  map: {
    height: 330,
  },
  bottomSheet: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: LaundryTheme.layout.bottomMenuSpace - 56,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...LaundryTheme.shadow.soft,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    color: LaundryTheme.colors.ink,
    fontWeight: "800",
  },
  progressValue: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: LaundryTheme.colors.primarySoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: LaundryTheme.colors.primary,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FAF7FF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  metricLabel: {
    color: LaundryTheme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  metricValue: {
    marginTop: 4,
    color: LaundryTheme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  trackButton: {
    marginTop: 14,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    ...LaundryTheme.shadow.strong,
  },
  trackText: {
    color: "#fff",
    fontWeight: "800",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  loadingText: {
    color: LaundryTheme.colors.muted,
    fontWeight: "600",
  },
  emptyBlock: {
    gap: 8,
  },
  emptyTitle: {
    color: LaundryTheme.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyBody: {
    color: LaundryTheme.colors.muted,
    lineHeight: 20,
  },
});
