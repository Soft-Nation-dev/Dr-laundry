import { SoftPressable } from "@/components/soft-pressable";
import { MapUnavailableOverlay } from "@/components/map-unavailable-overlay";
import { useMapTileHealth } from "@/hooks/use-map-tile-health";
import { setAppMode } from "@/lib/app-mode";
import { getCompletedDriverTasks, getDriverTasks, type DriverTask } from "@/lib/driver-api";
import { formatNaira } from "@/lib/pricing";
import { getProfile } from "@/lib/profile-api";
import { canUseDriverMode, getLandingRoute } from "@/lib/role-routing";
import { supabase } from "@/lib/supabase-client";
import type { AppRole } from "@/types/profile";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

type QueueTab = "available" | "mine";
const ENUGU = { latitude: 6.4584, longitude: 7.5464 };

export default function DriverHomeScreen() {
  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [tab, setTab] = useState<QueueTab>("available");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [role, setRole] = useState<AppRole>("customer");
  const [completedCount, setCompletedCount] = useState(0);
  const mapHealth = useMapTileHealth(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setError("");
    const profileResult = await getProfile();
    const nextRole = profileResult.data?.role ?? "customer";
    setRole(nextRole);
    const allowed = profileResult.success && !!profileResult.data && canUseDriverMode(nextRole);
    setAuthorized(allowed);
    if (!allowed) { setLoading(false); setRefreshing(false); return; }
    const [result, completedResult] = await Promise.all([getDriverTasks(), getCompletedDriverTasks()]);
    if (result.success) setTasks(result.data ?? []);
    else setError(result.message || "Driver tasks could not be loaded.");
    if (completedResult.success) setCompletedCount(completedResult.data?.length ?? 0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!authorized) return;
    const channel = supabase.channel("driver-order-queue").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => { void load(true); },
    );
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [authorized, load]);

  const visibleTasks = useMemo(() => tasks.filter((task) => tab === "available" ? task.status === "available" : task.assignedToMe && task.status !== "completed"), [tab, tasks]);
  const mappedTasks = visibleTasks.filter((task) => task.locationAvailable && task.latitude !== null && task.longitude !== null);
  const missingLocationCount = visibleTasks.length - mappedTasks.length;
  const acceptedCount = tasks.filter((task) => task.assignedToMe && task.status !== "completed").length;

  const leaveDriverMode = async () => {
    if (role === "driver") { router.push("/settings"); return; }
    await setAppMode("customer");
    router.replace(getLandingRoute(role) as never);
  };
  const switchToCustomer = leaveDriverMode;

  if (loading) return <LinearGradient colors={["#26104B", "#100621", "#07030F"]} style={styles.container}><SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#B887F0" /><Text style={styles.stateText}>Preparing driver workspace…</Text></SafeAreaView></LinearGradient>;

  if (authorized === false) return <LinearGradient colors={["#26104B", "#100621", "#07030F"]} style={styles.container}><SafeAreaView style={styles.center}><View style={styles.lockIcon}><Ionicons name="lock-closed" size={31} color="#D6B4FF" /></View><Text style={styles.stateTitle}>Driver access isn’t enabled</Text><Text style={styles.stateText}>Your backend profile is currently a customer account. An administrator must assign the driver role before tasks can be viewed or updated.</Text><SoftPressable onPress={switchToCustomer} style={styles.customerButton}><Text style={styles.customerButtonText}>Return to Customer Mode</Text></SoftPressable></SafeAreaView></LinearGradient>;

  return (
    <LinearGradient colors={["#26104B", "#100621", "#07030F"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} tintColor="#B887F0" onRefresh={() => { setRefreshing(true); void load(); }} />}>
          <View style={styles.header}><View><Text style={styles.kicker}>DR LAUNDRY · DRIVER</Text><Text style={styles.title}>Task Console</Text><Text style={styles.subtitle}>Live pickups and deliveries</Text></View><SoftPressable onPress={switchToCustomer} style={styles.modeButton}><Ionicons name="swap-horizontal" size={18} color="#FFFFFF" /></SoftPressable></View>

          <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{tasks.filter((task) => task.status === "available").length}</Text><Text style={styles.statLabel}>AVAILABLE</Text></View><View style={styles.statDivider} /><View style={styles.stat}><Text style={styles.statValue}>{acceptedCount}</Text><Text style={styles.statLabel}>MY TASKS</Text></View><View style={styles.statDivider} /><SoftPressable onPress={() => router.push("/driver/completed" as never)} style={styles.stat}><Text style={styles.statValue}>{completedCount}</Text><Text style={styles.statLabel}>COMPLETED ›</Text></SoftPressable></View>

          <View style={styles.mapCard}><View style={styles.mapHeader}><View><Text style={styles.mapTitle}>Live service map</Text><Text style={styles.mapCaption}>{mappedTasks.length} located task{mappedTasks.length === 1 ? "" : "s"}{missingLocationCount ? ` · ${missingLocationCount} needs attention` : " · Enugu coverage"}</Text></View><View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View></View><View style={styles.mapFrame}><MapView key={mapHealth.renderKey} provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={{ ...ENUGU, latitudeDelta: 0.14, longitudeDelta: 0.14 }} loadingEnabled loadingBackgroundColor="#171022" loadingIndicatorColor="#B887F0" onMapLoaded={mapHealth.markLoaded}>{mappedTasks.map((task) => <Marker key={task.id} coordinate={{ latitude: task.latitude!, longitude: task.longitude! }} title={task.customerName} description={`${task.type} · ${task.timeSlot}`}><View style={[styles.marker, task.type === "delivery" && styles.deliveryMarker]}><Ionicons name={task.type === "pickup" ? "bag-handle" : "navigate"} size={12} color="#FFFFFF" /></View></Marker>)}</MapView>{mapHealth.timedOut ? <MapUnavailableOverlay dark message="Map tiles did not load. Check the connection, then retry." onRetry={mapHealth.retry} /> : null}</View></View>

          <View style={styles.queueHeader}><View><Text style={styles.sectionTitle}>Task queue</Text><Text style={styles.sectionCaption}>Updates are synced from the backend</Text></View><Ionicons name="sync" size={17} color="#A78AC5" /></View>
          <View style={styles.tabs}><SoftPressable onPress={() => setTab("available")} style={[styles.tab, tab === "available" && styles.activeTab]}><Text style={[styles.tabText, tab === "available" && styles.activeTabText]}>Available</Text></SoftPressable><SoftPressable onPress={() => setTab("mine")} style={[styles.tab, tab === "mine" && styles.activeTab]}><Text style={[styles.tabText, tab === "mine" && styles.activeTabText]}>My Tasks</Text></SoftPressable></View>

          {error ? <View style={styles.errorCard}><Ionicons name="cloud-offline-outline" size={23} color="#FF9BB2" /><View style={styles.errorCopy}><Text style={styles.errorTitle}>Couldn’t sync tasks</Text><Text style={styles.errorText}>{error}</Text></View><SoftPressable onPress={() => void load()}><Text style={styles.retryText}>Retry</Text></SoftPressable></View> : null}
          <View style={styles.taskList}>{visibleTasks.length ? visibleTasks.map((task) => <SoftPressable key={task.id} onPress={() => router.push({ pathname: "/driver/task-detail" as never, params: { taskId: task.id } })} style={[styles.taskCard, !task.locationAvailable && styles.taskCardLocationError]}><View style={[styles.typeIcon, task.type === "delivery" && styles.deliveryIcon]}><Ionicons name={task.type === "pickup" ? "bag-handle-outline" : "navigate-outline"} size={21} color="#FFFFFF" /></View><View style={styles.taskCopy}><View style={styles.taskTop}><Text style={styles.typeLabel}>{task.type.toUpperCase()}</Text><Text style={styles.taskId}>#{task.orderId}</Text><View style={[styles.paymentStamp, task.paymentStatus === "paid" ? styles.paidStamp : styles.unpaidStamp]}><Text style={[styles.paymentText, task.paymentStatus === "paid" ? styles.paidText : styles.unpaidText]}>{task.paymentStatus === "paid" ? "PAID" : "UNPAID"}</Text></View></View><Text style={styles.customer}>{task.customerName}</Text><Text style={styles.address} numberOfLines={1}>{task.address}</Text>{!task.locationAvailable ? <View style={styles.locationWarning}><Ionicons name="warning-outline" size={12} color="#FFB0C3" /><Text style={styles.locationWarningText}>LOCATION NEEDS OPERATIONS</Text></View> : <View style={styles.timeRow}><Ionicons name="time-outline" size={13} color="#AB94C2" /><Text style={styles.time}>{task.timeSlot}</Text>{task.isExpress ? <Text style={styles.express}>EXPRESS</Text> : null}<Text style={styles.price} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1}>{formatNaira(task.paidAmount)}</Text></View>}</View><Ionicons name="chevron-forward" size={18} color="#876BA4" /></SoftPressable>) : <View style={styles.emptyCard}><Ionicons name="checkmark-done-circle-outline" size={30} color="#AD8BCF" /><Text style={styles.emptyTitle}>Queue is clear</Text><Text style={styles.emptyText}>{tab === "available" ? "Orders released by operations will appear here automatically." : "Accept an available task to add it to your queue."}</Text></View>}</View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 }, content: { paddingHorizontal: 19, paddingTop: 16, paddingBottom: 42 }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }, stateTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 15, textAlign: "center" }, stateText: { color: "#BBA8CE", textAlign: "center", lineHeight: 20, marginTop: 8 }, lockIcon: { width: 70, height: 70, borderRadius: 24, backgroundColor: "rgba(184,135,240,0.13)", alignItems: "center", justifyContent: "center" }, customerButton: { marginTop: 22, borderRadius: 15, backgroundColor: "#7C2BC2", paddingHorizontal: 18, paddingVertical: 13 }, customerButtonText: { color: "#FFFFFF", fontWeight: "900" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, kicker: { color: "#B887F0", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }, title: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", letterSpacing: -0.8, marginTop: 3 }, subtitle: { color: "#9F8BB3", fontSize: 12, marginTop: 2 }, modeButton: { width: 47, height: 47, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", alignItems: "center", marginTop: 20, paddingVertical: 16, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.065)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, stat: { flex: 1, alignItems: "center" }, statValue: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" }, statLabel: { color: "#8F7DA3", fontSize: 8, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 }, statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.08)" },
  mapCard: { marginTop: 15, borderRadius: 23, padding: 13, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, mapHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 2, marginBottom: 10 }, mapTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" }, mapCaption: { color: "#8E7A9F", fontSize: 10, marginTop: 2 }, liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: "rgba(32,193,132,0.13)" }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#20C184" }, liveText: { color: "#58D9A6", fontSize: 8, fontWeight: "900" }, mapFrame: { height: 184, borderRadius: 17, overflow: "hidden" }, map: { flex: 1 }, marker: { width: 27, height: 27, borderRadius: 14, backgroundColor: "#7C2BC2", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }, deliveryMarker: { backgroundColor: "#149A6E" },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22 }, sectionTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" }, sectionCaption: { color: "#8D789F", fontSize: 10, marginTop: 2 }, tabs: { marginTop: 12, padding: 4, borderRadius: 16, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.07)" }, tab: { flex: 1, minHeight: 41, borderRadius: 13, alignItems: "center", justifyContent: "center" }, activeTab: { backgroundColor: "#7C2BC2" }, tabText: { color: "#9D89B2", fontSize: 12, fontWeight: "800" }, activeTabText: { color: "#FFFFFF" },
  errorCard: { marginTop: 12, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(200,74,104,0.12)", borderWidth: 1, borderColor: "rgba(255,130,158,0.16)" }, errorCopy: { flex: 1, marginHorizontal: 9 }, errorTitle: { color: "#FFD7E1", fontSize: 12, fontWeight: "800" }, errorText: { color: "#BFA4AD", fontSize: 10, marginTop: 2 }, retryText: { color: "#FFB0C3", fontSize: 11, fontWeight: "900" },
  taskList: { marginTop: 12, gap: 11 }, taskCard: { minHeight: 116, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.065)", borderWidth: 1, borderColor: "rgba(255,255,255,0.065)" }, taskCardLocationError: { borderColor: "rgba(255,155,178,0.28)", backgroundColor: "rgba(193,67,99,0.08)" }, typeIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: "#7C2BC2", alignItems: "center", justifyContent: "center" }, deliveryIcon: { backgroundColor: "#149A6E" }, taskCopy: { flex: 1, marginHorizontal: 12 }, taskTop: { flexDirection: "row", alignItems: "center", gap: 6 }, typeLabel: { color: "#B887F0", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, taskId: { flex: 1, color: "#756689", fontSize: 9, fontWeight: "700" }, paymentStamp: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 }, paidStamp: { backgroundColor: "rgba(32,193,132,0.12)", borderColor: "rgba(83,213,165,0.25)" }, unpaidStamp: { backgroundColor: "rgba(242,172,60,0.12)", borderColor: "rgba(242,172,60,0.25)" }, paymentText: { fontSize: 7, fontWeight: "900", letterSpacing: 0.5 }, paidText: { color: "#53D5A5" }, unpaidText: { color: "#F2AC3C" }, customer: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 5 }, address: { color: "#AD9CBC", fontSize: 11, marginTop: 3 }, locationWarning: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 5 }, locationWarningText: { color: "#FFB0C3", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 }, timeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 }, time: { color: "#9E89B4", fontSize: 10, fontWeight: "600" }, express: { color: "#FFBC62", fontSize: 8, fontWeight: "900", marginLeft: 4 }, price: { marginLeft: "auto", width: 96, textAlign: "right", color: "#D4B1F4", fontSize: 10.5, fontWeight: "900" }, emptyCard: { alignItems: "center", padding: 26, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)" }, emptyTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 8 }, emptyText: { color: "#9B87AD", fontSize: 11, textAlign: "center", lineHeight: 17, marginTop: 4 },
});
