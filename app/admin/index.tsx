import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getAdminOrders } from "@/lib/admin-api";
import { getProfile } from "@/lib/profile-api";
import { canViewAdminOrders, getLandingRoute } from "@/lib/role-routing";
import type { AppRole } from "@/types/profile";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type DashboardEntry = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  route: string;
  accent?: boolean;
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ active: 0, unassigned: 0, completed: 0 });

  const load = useCallback(async () => {
    setError("");
    const profile = await getProfile();
    if (!profile.success || !profile.data) {
      setError(profile.message || "Your admin workspace could not be loaded.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!canViewAdminOrders(profile.data.role)) {
      router.replace(getLandingRoute(profile.data?.role ?? "customer") as never);
      return;
    }
    setRole(profile.data.role);
    try {
      const orders = await getAdminOrders();
      const operationalOrders = orders.filter((order) => !order.isReviewOrder);
      setCounts({
        active: operationalOrders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
        unassigned: operationalOrders.filter((order) => ["paid", "unpaid"].includes(order.paymentStatus) && !order.driverId && !["delivered", "cancelled"].includes(order.status)).length,
        completed: operationalOrders.filter((order) => order.status === "delivered").length,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Operations could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards: DashboardEntry[] = role === "superadmin"
    ? [
        { icon: "receipt-outline", title: "Available orders", detail: "Every customer order and live state", route: "/admin/orders" },
        { icon: "car-sport-outline", title: "Driver mode", detail: "Pickup and delivery task console", route: "/driver/home", accent: true },
        { icon: "people-outline", title: "Manage roles", detail: "Customer, driver and admin access", route: "/admin/users" },
        { icon: "map-outline", title: "Popular locations", detail: "Customer demand and service hotspots", route: "/admin/locations" },
        { icon: "analytics-outline", title: "Income", detail: "Revenue and payment history", route: "/admin/income", accent: true },
        { icon: "settings-outline", title: "App settings", detail: "Profile, security and notifications", route: "/settings" },
      ]
    : [
        { icon: "receipt-outline", title: "Available orders", detail: "Manage customer orders and live states", route: "/admin/orders" },
        { icon: "car-sport-outline", title: "Driver mode", detail: "Open pickup and delivery tasks", route: "/driver/home", accent: true },
        { icon: "settings-outline", title: "App settings", detail: "Profile, security and notifications", route: "/settings" },
      ];

  return (
    <LinearGradient colors={["#2B0B50", "#5B168F", "#A04EDD"]} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#FFFFFF" colors={["#681DA6"]} />}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View><Text style={styles.kicker}>DR LAUNDRY OPERATIONS</Text><Text style={styles.title}>{role === "superadmin" ? "Superadmin" : "Admin"}</Text></View>
            <SoftPressable onPress={() => router.push("/settings")} style={styles.settings}><Ionicons name="settings-outline" size={19} color="#FFFFFF" /></SoftPressable>
          </View>

          <View style={styles.stats}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Stat value={counts.active} label="ACTIVE" />
              <View style={styles.divider} />
              <Stat value={counts.unassigned} label="AVAILABLE" />
              <View style={styles.divider} />
              <Stat value={counts.completed} label="DELIVERED" />
            </>}
          </View>

          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Operations centre</Text>
            <Text style={styles.sheetCaption}>{role === "superadmin" ? "Full operations and access control in one workspace." : "Order operations, driver tools and settings."}</Text>
            {error ? <SoftPressable onPress={() => void load()} style={styles.errorCard}><Ionicons name="cloud-offline-outline" size={19} color="#A23A56" /><View style={{ flex: 1 }}><Text style={styles.errorTitle}>Workspace unavailable</Text><Text style={styles.errorText}>{error}</Text></View><Text style={styles.retry}>Retry</Text></SoftPressable> : null}
            {!error && role ? <View style={styles.grid}>
              {cards.map((card, index) => (
                <DashboardCard
                  key={card.route}
                  icon={card.icon}
                  title={card.title}
                  detail={card.detail}
                  onPress={() => router.push(card.route as never)}
                  accent={card.accent}
                  wide={role === "admin" && index === cards.length - 1}
                />
              ))}
            </View> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>;
}

function DashboardCard({ icon, title, detail, onPress, accent = false, wide = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void; accent?: boolean; wide?: boolean }) {
  return <SoftPressable accessibilityRole="button" onPress={onPress} style={[styles.card, wide && styles.cardWide, accent && styles.cardAccent]}><View style={[styles.cardIcon, accent && styles.cardIconAccent]}><Ionicons name={icon} size={22} color={accent ? "#FFFFFF" : "#681DA6"} /></View><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDetail}>{detail}</Text><Ionicons name="arrow-forward-circle" size={22} color="#9A75B8" style={styles.arrow} /></SoftPressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1 }, scrollContent: { flexGrow: 1, paddingTop: 14 }, header: { paddingHorizontal: 21, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, kicker: { color: "#D7B6F1", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }, title: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", marginTop: 3 }, settings: { width: 45, height: 45, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  stats: { minHeight: 82, margin: 20, marginTop: 24, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }, stat: { flex: 1, alignItems: "center" }, divider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.14)" }, value: { color: "#FFFFFF", fontSize: 23, fontWeight: "900" }, label: { color: "#D8C3E8", fontSize: 8, fontWeight: "900", marginTop: 3, letterSpacing: 0.8 },
  sheet: { flexGrow: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 25, paddingBottom: 48, backgroundColor: "#FAF7FD" }, sheetTitle: { color: LaundryTheme.colors.ink, fontSize: 22, fontWeight: "900" }, sheetCaption: { color: LaundryTheme.colors.muted, fontSize: 11, marginTop: 4 }, grid: { marginTop: 19, flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 12, alignItems: "flex-start" },
  card: { width: "48%", minHeight: 174, padding: 15, borderRadius: 23, alignSelf: "flex-start", overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE1F0", ...LaundryTheme.shadow.soft }, cardWide: { width: "100%", minHeight: 142 }, cardAccent: { backgroundColor: "#F5EAFE", borderColor: "#DEC7ED" }, cardIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#F1E5FA" }, cardIconAccent: { backgroundColor: "#681DA6" }, cardTitle: { color: LaundryTheme.colors.ink, fontSize: 14, fontWeight: "900", marginTop: 13 }, cardDetail: { color: LaundryTheme.colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4, paddingRight: 10 }, arrow: { position: "absolute", right: 13, bottom: 13 },
  errorCard: { marginTop: 18, padding: 14, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF1F4", borderWidth: 1, borderColor: "#F0CCD5" }, errorTitle: { color: "#7E2A40", fontSize: 11.5, fontWeight: "900" }, errorText: { color: "#8C6570", fontSize: 9.5, lineHeight: 14, marginTop: 2 }, retry: { color: "#681DA6", fontSize: 10, fontWeight: "900" },
});
