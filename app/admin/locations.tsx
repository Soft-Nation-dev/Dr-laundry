import { AppToast, type AppToastMessage } from "@/components/app-toast";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getLocationAnalytics, type LocationAnalytics } from "@/lib/admin-api";
import { formatNaira } from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PopularLocationsScreen() {
  const [data, setData] = useState<LocationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const load = useCallback(async () => {
    try { setData(await getLocationAnalytics()); }
    catch (error) { setToast({ id: Date.now(), title: "Locations unavailable", message: error instanceof Error ? error.message : "Try again.", tone: "error" }); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("admin-location-analytics")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  return <LinearGradient colors={["#2B0B50", "#681DA6", "#F8F4FB"]} locations={[0, 0.28, 0.28]} style={styles.container}><SafeAreaView style={styles.safe}>
    <View style={styles.header}><SoftPressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></SoftPressable><View><Text style={styles.kicker}>EXPANSION INTELLIGENCE</Text><Text style={styles.title}>Popular locations</Text></View></View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#681DA6" />} contentContainerStyle={styles.content}>
      {loading ? <ActivityIndicator color="#681DA6" style={{ marginTop: 60 }} /> : data ? <>
        <View style={styles.stats}><Stat value={data.totals.uniqueCustomers} label="CUSTOMERS" /><Stat value={data.totals.mappedOrders} label="ORDERS" /><Stat value={data.totals.mappedLocations} label="LOCATIONS" /></View>
        <Text style={styles.section}>Hotspots</Text><Text style={styles.caption}>Nearby addresses within {data.totals.clusterRadiusKm} km are grouped into one service area, then ranked by customers and order frequency.</Text>
        {data.locations.map((location, index) => <View key={location.placeId || `${location.label}-${index}`} style={styles.card}>
          <LinearGradient colors={index < 3 ? ["#681DA6", "#A248D4"] : ["#F2E7FA", "#E6D6F1"]} style={styles.rank}><Text style={[styles.rankText, index >= 3 && { color: "#681DA6" }]}>#{index + 1}</Text></LinearGradient>
          <View style={{ flex: 1 }}><Text style={styles.location} numberOfLines={2}>{location.label}</Text><Text style={styles.meta}>{location.customerCount} customers · {location.orderCount} orders{location.radiusKm > 0 ? ` · ${location.radiusKm} km spread` : ""}</Text><View style={styles.heatTrack}><View style={[styles.heatFill, { width: `${Math.max(12, Math.min(100, location.heatScore / Math.max(1, data.locations[0]?.heatScore || 1) * 100))}%` }]} /></View></View>
          <Text style={styles.revenue}>{formatNaira(location.paidRevenue)}</Text>
        </View>)}
      </> : null}
    </ScrollView><AppToast toast={toast} onDismiss={() => setToast(null)} /></SafeAreaView></LinearGradient>;
}

function Stat({ value, label }: { value: number; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1 }, header: { minHeight: 145, paddingHorizontal: 20, paddingTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 13 }, back: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" }, kicker: { color: "#D9BDEB", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.3, marginTop: 2 }, title: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", marginTop: 5 }, content: { minHeight: 650, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 19, paddingBottom: 60, backgroundColor: "#F8F4FB" },
  stats: { minHeight: 80, borderRadius: 21, padding: 12, flexDirection: "row", backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.soft }, stat: { flex: 1, alignItems: "center", justifyContent: "center" }, statValue: { color: "#5B168F", fontSize: 21, fontWeight: "900" }, statLabel: { color: "#998BA1", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.7, marginTop: 3 }, section: { color: "#33263B", fontSize: 20, fontWeight: "900", marginTop: 23 }, caption: { color: "#93869A", fontSize: 10.5, lineHeight: 16, marginTop: 4, marginBottom: 13 }, card: { minHeight: 92, borderRadius: 21, padding: 13, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EDE5F1" }, rank: { width: 46, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" }, rankText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, location: { color: "#382B40", fontSize: 12, lineHeight: 17, fontWeight: "900" }, meta: { color: "#93869A", fontSize: 9.5, marginTop: 3 }, heatTrack: { height: 4, borderRadius: 99, overflow: "hidden", backgroundColor: "#EEE7F2", marginTop: 8 }, heatFill: { height: "100%", borderRadius: 99, backgroundColor: "#8B36C1" }, revenue: { width: 82, color: "#087A58", fontSize: 11, fontWeight: "900", textAlign: "right" },
});
