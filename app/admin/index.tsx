import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getAdminOrders } from "@/lib/admin-api";
import { getProfile } from "@/lib/profile-api";
import { getLandingRoute } from "@/lib/role-routing";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SuperadminDashboard() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ active: 0, unassigned: 0, completed: 0 });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const profile = await getProfile();
      if (!mounted) return;
      if (!profile.success || profile.data?.role !== "superadmin") {
        router.replace(getLandingRoute(profile.data?.role ?? "customer") as never);
        return;
      }
      try {
        const orders = await getAdminOrders();
        if (mounted) setCounts({
          active: orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
          unassigned: orders.filter((order) => ["paid", "unpaid"].includes(order.paymentStatus) && !order.driverId && !["delivered", "cancelled"].includes(order.status)).length,
          completed: orders.filter((order) => order.status === "delivered").length,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <LinearGradient colors={["#2B0B50", "#5B168F", "#A04EDD"]} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View><Text style={styles.kicker}>DR LAUNDRY OPERATIONS</Text><Text style={styles.title}>Superadmin</Text></View>
          <SoftPressable onPress={() => router.push("/settings")} style={styles.settings}><Ionicons name="settings-outline" size={21} color="#FFFFFF" /></SoftPressable>
        </View>

        <View style={styles.stats}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <>
            <View style={styles.stat}><Text style={styles.value}>{counts.active}</Text><Text style={styles.label}>ACTIVE</Text></View>
            <View style={styles.stat}><Text style={styles.value}>{counts.unassigned}</Text><Text style={styles.label}>AVAILABLE</Text></View>
            <View style={styles.stat}><Text style={styles.value}>{counts.completed}</Text><Text style={styles.label}>DELIVERED</Text></View>
          </>}
        </View>

        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Operations centre</Text>
          <Text style={styles.sheetCaption}>Everything privileged is kept in one clear workspace.</Text>
          <View style={styles.grid}>
            <DashboardCard icon="receipt-outline" title="Available orders" detail="Every customer order and live state" onPress={() => router.push("/admin/orders" as never)} />
            <DashboardCard icon="car-sport-outline" title="Driver mode" detail="Pickup and delivery task console" onPress={() => router.push("/driver/home" as never)} accent />
            <DashboardCard icon="people-outline" title="Manage roles" detail="Customer, driver and admin access" onPress={() => router.push("/admin/users" as never)} />
            <DashboardCard icon="settings-outline" title="App settings" detail="Profile, security and notifications" onPress={() => router.push("/settings")} />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function DashboardCard({ icon, title, detail, onPress, accent = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void; accent?: boolean }) {
  return <SoftPressable onPress={onPress} style={[styles.card, accent && styles.cardAccent]}><View style={[styles.cardIcon, accent && styles.cardIconAccent]}><Ionicons name={icon} size={22} color={accent ? "#FFFFFF" : "#681DA6"} /></View><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDetail}>{detail}</Text><Ionicons name="arrow-forward-circle" size={22} color="#9A75B8" style={styles.arrow} /></SoftPressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1, paddingTop: 14 }, header: { paddingHorizontal: 21, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, kicker: { color: "#D7B6F1", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }, title: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", marginTop: 3 }, settings: { width: 45, height: 45, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  stats: { minHeight: 82, margin: 20, marginTop: 24, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" }, stat: { flex: 1, alignItems: "center" }, value: { color: "#FFFFFF", fontSize: 23, fontWeight: "900" }, label: { color: "#D8C3E8", fontSize: 8, fontWeight: "900", marginTop: 3, letterSpacing: 0.8 },
  sheet: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 25, backgroundColor: "#FAF7FD" }, sheetTitle: { color: LaundryTheme.colors.ink, fontSize: 22, fontWeight: "900" }, sheetCaption: { color: LaundryTheme.colors.muted, fontSize: 11, marginTop: 4 }, grid: { marginTop: 19, flexDirection: "row", flexWrap: "wrap", gap: 12 }, card: { width: "48%", minHeight: 174, padding: 15, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE1F0", ...LaundryTheme.shadow.soft }, cardAccent: { backgroundColor: "#F5EAFE" }, cardIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#F1E5FA" }, cardIconAccent: { backgroundColor: "#681DA6" }, cardTitle: { color: LaundryTheme.colors.ink, fontSize: 14, fontWeight: "900", marginTop: 13 }, cardDetail: { color: LaundryTheme.colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4, paddingRight: 10 }, arrow: { position: "absolute", right: 13, bottom: 13 },
});
