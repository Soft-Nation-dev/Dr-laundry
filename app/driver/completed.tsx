import { SoftPressable } from "@/components/soft-pressable";
import { getCompletedDriverTasks, type DriverTask } from "@/lib/driver-api";
import { formatDayOnly, formatNaira } from "@/lib/pricing";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CompletedDriverTasksScreen() {
  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const result = await getCompletedDriverTasks();
    if (result.success) setTasks(result.data ?? []);
    else setError(result.message || "Completed tasks could not be loaded.");
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <LinearGradient colors={["#26104B", "#100621", "#07030F"]} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}>
          <SoftPressable onPress={() => router.canGoBack() ? router.back() : router.replace("/driver/home" as never)} style={styles.back}><Ionicons name="chevron-back" size={20} color="#FFFFFF" /></SoftPressable>
          <View style={styles.headerCopy}><Text style={styles.kicker}>PERMANENT DRIVER LOG</Text><Text style={styles.title}>Completed Tasks</Text></View>
          <View style={styles.total}><Text style={styles.totalText}>{tasks.length}</Text></View>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} tintColor="#B887F0" onRefresh={() => { setRefreshing(true); void load(); }} />}>
          {loading ? <View style={styles.state}><ActivityIndicator color="#B887F0" /><Text style={styles.stateTitle}>Loading your history…</Text></View> : error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={30} color="#FF9BB2" /><Text style={styles.stateTitle}>Couldn’t load completed tasks</Text><Text style={styles.stateText}>{error}</Text><SoftPressable onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></SoftPressable></View> : !tasks.length ? <View style={styles.state}><Ionicons name="checkmark-done-circle-outline" size={35} color="#B887F0" /><Text style={styles.stateTitle}>No completed tasks yet</Text><Text style={styles.stateText}>Finished pickups and deliveries will stay here for your records.</Text></View> : tasks.map((task) => <SoftPressable key={`${task.id}-${task.type}-${task.completedAtISO}`} onPress={() => router.push({ pathname: "/driver/task-detail" as never, params: { taskId: task.id, completedType: task.type } })} style={styles.card}>
            <View style={[styles.icon, task.type === "delivery" && styles.deliveryIcon]}><Ionicons name={task.type === "pickup" ? "bag-check-outline" : "checkmark-done-outline"} size={22} color="#FFFFFF" /></View>
            <View style={styles.cardCopy}><View style={styles.cardTop}><Text style={styles.type}>{task.type.toUpperCase()} COMPLETED</Text><View style={[styles.payment, task.paymentStatus === "paid" ? styles.paid : styles.unpaid]}><Text style={[styles.paymentText, task.paymentStatus === "paid" ? styles.paidText : styles.unpaidText]}>{task.paymentStatus === "paid" ? "PAID" : "UNPAID"}</Text></View></View><Text style={styles.customer}>{task.customerName}</Text><Text style={styles.meta}>#{task.orderId} · {task.completedAtISO ? formatDayOnly(task.completedAtISO) : "Completed"}</Text><Text style={styles.price} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1}>{formatNaira(task.paidAmount)}</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#876BA4" />
          </SoftPressable>)}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1 }, header: { padding: 18, flexDirection: "row", alignItems: "center" }, back: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.09)" }, headerCopy: { flex: 1, marginLeft: 12 }, kicker: { color: "#B887F0", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.2 }, title: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginTop: 2 }, total: { minWidth: 39, height: 39, paddingHorizontal: 10, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(184,135,240,0.15)" }, totalText: { color: "#DDBEFF", fontSize: 15, fontWeight: "900" }, content: { paddingHorizontal: 18, paddingBottom: 35, gap: 11 }, state: { marginTop: 28, padding: 28, borderRadius: 22, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)" }, stateTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 9, textAlign: "center" }, stateText: { color: "#A996BA", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 5 }, retry: { marginTop: 13, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: "#7C2BC2" }, retryText: { color: "#FFFFFF", fontWeight: "900" }, card: { minHeight: 121, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.065)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }, icon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#7C2BC2" }, deliveryIcon: { backgroundColor: "#149A6E" }, cardCopy: { flex: 1, marginHorizontal: 12 }, cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, type: { flex: 1, color: "#B887F0", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.7 }, payment: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 }, paid: { backgroundColor: "rgba(32,193,132,0.12)", borderColor: "rgba(83,213,165,0.25)" }, unpaid: { backgroundColor: "rgba(242,172,60,0.12)", borderColor: "rgba(242,172,60,0.25)" }, paymentText: { fontSize: 7.5, fontWeight: "900", letterSpacing: 0.6 }, paidText: { color: "#53D5A5" }, unpaidText: { color: "#F2AC3C" }, customer: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginTop: 5 }, meta: { color: "#9885A9", fontSize: 9.5, marginTop: 3 }, price: { width: 125, color: "#D4B1F4", fontSize: 13, lineHeight: 18, fontWeight: "900", marginTop: 5 },
});
