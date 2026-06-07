import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
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
  badge?: string;
};

const homeActions: HomeAction[] = [
  { label: "Pickup", icon: "calendar-outline", route: "/pickup-dates" },
  { label: "History", icon: "receipt-outline", route: "/order-history" },
  { label: "Track", icon: "navigate-outline", route: "/track-order" },
  { label: "Price List", icon: "shirt-outline", route: "/new-order" },
  { label: "Pay", icon: "card-outline", route: "/payment" },
  { label: "Express", icon: "flash-outline", route: "/membership" },
  { label: "Support", icon: "chatbubbles-outline", route: "/support" },
  { label: "Profile", icon: "person-outline", route: "/profile", badge: "2" },
];

const userName = "Soft Nation";

export default function HomeScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: LaundryTheme.motion.medium,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  return (
    <LinearGradient
      colors={[
        LaundryTheme.colors.bgStart,
        "#FFFFFF",
        LaundryTheme.colors.bgEnd,
      ]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Animated.View
            style={[
              styles.headerRow,
              { opacity: fade, transform: [{ translateY: rise }] },
            ]}
          >
            <View style={styles.brandBlock}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                contentFit="contain"
              />
              <View>
                <Text style={styles.kicker}>Dr Laundry</Text>
                <Text style={styles.title}>Hi {userName}</Text>
              </View>
            </View>
            <View style={styles.headerPills}>
              <View style={styles.iconPill}>
                <Ionicons
                  name="notifications-outline"
                  size={17}
                  color={LaundryTheme.colors.ink}
                />
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userName[0]}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.statusCard,
              { opacity: fade, transform: [{ translateY: rise }] },
            ]}
          >
            <View>
              <Text style={styles.statusLabel}>Next Pickup</Text>
              <Text style={styles.statusTime}>Today, 2:40 PM</Text>
            </View>
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>Awaiting rider</Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.grid,
              { opacity: fade, transform: [{ translateY: rise }] },
            ]}
          >
            {homeActions.map((item) => (
              <SoftPressable
                key={item.label}
                onPress={() => router.push(item.route as never)}
                style={styles.actionTile}
              >
                <View style={styles.actionIconWrap}>
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={LaundryTheme.colors.primaryDark}
                  />
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.actionLabel}>{item.label}</Text>
              </SoftPressable>
            ))}
          </Animated.View>

          <View style={styles.quickRow}>
            <View style={styles.quickCard}>
              <Ionicons
                name="cube-outline"
                size={20}
                color={LaundryTheme.colors.primaryDark}
              />
              <Text style={styles.quickValue}>3</Text>
              <Text style={styles.quickLabel}>In Process</Text>
            </View>
            <View style={styles.quickCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={LaundryTheme.colors.primaryDark}
              />
              <Text style={styles.quickValue}>28</Text>
              <Text style={styles.quickLabel}>Delivered</Text>
            </View>
            <View style={styles.quickCard}>
              <Ionicons
                name="wallet-outline"
                size={20}
                color={LaundryTheme.colors.warning}
              />
              <Text style={styles.quickValue}>NGN 4,500</Text>
              <Text style={styles.quickLabel}>Pending</Text>
            </View>
          </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    ...LaundryTheme.shadow.soft,
  },
  kicker: {
    fontSize: 13,
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
  },
  title: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.3,
  },
  headerPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: LaundryTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...LaundryTheme.shadow.soft,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  statusCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: LaundryTheme.colors.primary,
    ...LaundryTheme.shadow.strong,
  },
  statusLabel: {
    color: "#E8DBFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statusTime: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  statusChip: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  grid: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  actionTile: {
    width: "23%",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 14,
    minHeight: 94,
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    ...LaundryTheme.shadow.soft,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LaundryTheme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  actionLabel: {
    marginTop: 7,
    fontSize: 11,
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },
  quickRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickCard: {
    width: "32%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    ...LaundryTheme.shadow.soft,
  },
  quickValue: {
    marginTop: 7,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    fontSize: 14,
  },
  quickLabel: {
    marginTop: 3,
    color: LaundryTheme.colors.muted,
    fontSize: 11,
  },
});
