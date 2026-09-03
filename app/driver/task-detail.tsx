import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { AppToast, type AppToastMessage } from "@/components/app-toast";
import { MapUnavailableOverlay } from "@/components/map-unavailable-overlay";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { useDriverLocationPublisher } from "@/hooks/use-driver-location-publisher";
import { useLiveTracking } from "@/hooks/use-live-tracking";
import { useMapTileHealth } from "@/hooks/use-map-tile-health";
import { getDriverTask, markDriverOrderPaid, performDriverTaskAction, startDriverCustomerContact, type DriverTask, type DriverTaskAction } from "@/lib/driver-api";
import { getActiveDriverJourney, startDriverLocationSharing, stopDriverLocationSharing } from "@/lib/driver-location-task";
import { formatNaira } from "@/lib/pricing";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const ENUGU = { latitude: 6.4584, longitude: 7.5464 };
const BACKGROUND_LOCATION_DISCLOSURE =
  "Dr Laundry collects precise location data to enable live pickup and delivery journey tracking for the assigned customer, even when the app is closed or not in use. Location sharing begins only after you tap Start journey and stops when you complete or stop the task. Android displays a persistent notification while sharing.";

function nextAction(task: DriverTask): { action: DriverTaskAction; label: string } | null {
  if (task.status === "available") return { action: "accept", label: "Accept Task" };
  if (task.status === "accepted") return { action: "arrive", label: "I’ve Arrived" };
  if (task.status === "arrived") return { action: "complete", label: task.type === "pickup" ? "Confirm Pickup" : "Confirm Delivery" };
  return null;
}

export default function TaskDetailScreen() {
  const { taskId, completedType } = useLocalSearchParams<{ taskId?: string; completedType?: "pickup" | "delivery" }>();
  const [task, setTask] = useState<DriverTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [startingLocation, setStartingLocation] = useState(false);
  const [fullScreenMap, setFullScreenMap] = useState(false);
  const [contacting, setContacting] = useState<"call" | "sms" | null>(null);
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const mapRef = useRef<MapView | null>(null);
  const fullMapRef = useRef<MapView | null>(null);
  const mapHealth = useMapTileHealth(Boolean(task?.locationAvailable));
  const fullMapHealth = useMapTileHealth(Boolean(task?.locationAvailable && fullScreenMap));

  const load = useCallback(async () => {
    if (!taskId) { setError("This task link is incomplete."); setLoading(false); return; }
    setError("");
    const result = await getDriverTask(taskId, completedType);
    if (result.success) setTask(result.data);
    else setError(result.message);
    setLoading(false);
  }, [completedType, taskId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void getActiveDriverJourney().then((journey) => {
      const isCurrentJourney = Boolean(taskId && journey?.orderId === taskId);
      setSharing(isCurrentJourney);
      setBackgroundEnabled(Boolean(isCurrentJourney && journey?.backgroundEnabled));
    });
  }, [taskId]);

  const action = task ? nextAction(task) : null;
  const customerPoint = useMemo(() => task?.locationAvailable && task.latitude !== null && task.longitude !== null
    ? { latitude: task.latitude, longitude: task.longitude }
    : null, [task?.latitude, task?.locationAvailable, task?.longitude]);
  const liveTracking = useLiveTracking(task?.id);
  const publisher = useDriverLocationPublisher(task?.id, sharing);
  const hasDriverLocation = Boolean(publisher.point || liveTracking.location);
  const mapCenter = customerPoint ?? publisher.point ?? liveTracking.location ?? ENUGU;
  const driverPoint = useMemo(
    () => publisher.point ?? liveTracking.location ?? mapCenter,
    [liveTracking.location, mapCenter, publisher.point],
  );
  const mapRoute = liveTracking.routePoints;
  const routeCoordinates = useMemo(() => mapRoute.length > 1
    ? mapRoute
    : hasDriverLocation && customerPoint ? [driverPoint, customerPoint] : customerPoint ? [customerPoint] : [],
  [customerPoint, driverPoint, hasDriverLocation, mapRoute]);
  const fitMap = useCallback((map: MapView | null) => {
    if (!map || routeCoordinates.length < 2) return;
    map.fitToCoordinates(routeCoordinates, { edgePadding: { top: 70, right: 45, bottom: 70, left: 45 }, animated: true });
  }, [routeCoordinates]);

  useEffect(() => {
    if (mapRoute.length > 1) fitMap(mapRef.current);
    if (fullScreenMap) fitMap(fullMapRef.current);
  }, [fitMap, fullScreenMap, mapRoute.length]);

  const beginLocationSharing = async () => {
    if (!task || startingLocation) return;
    if (!task.locationAvailable) {
      setToast({ id: Date.now(), title: "Location needs attention", message: "Operations must verify this service address before the journey can start.", tone: "error" });
      return;
    }
    setStartingLocation(true);
    try {
      const result = await startDriverLocationSharing(task.id);
      setSharing(true);
      setBackgroundEnabled(result.backgroundEnabled);
      setShowLocationDisclosure(false);
    } catch (locationError) {
      Alert.alert("Location sharing not started", locationError instanceof Error ? locationError.message : "Check location permissions and try again.");
    } finally {
      setStartingLocation(false);
    }
  };

  const handleAction = async () => {
    if (!task || !action || working) return;
    if (action.action === "accept" && !task.locationAvailable) {
      setToast({ id: Date.now(), title: "Task cannot be accepted", message: "This order has no verified map location. Operations has to repair it first.", tone: "error" });
      return;
    }
    setWorking(true);
    const result = await performDriverTaskAction(task.id, action.action);
    setWorking(false);
    if (!result.success) { Alert.alert("Task not updated", result.message); return; }
    setTask(result.data);
    if (action.action === "accept") setShowLocationDisclosure(true);
    if (action.action === "complete") {
      await stopDriverLocationSharing(task.id);
      setSharing(false);
      setBackgroundEnabled(false);
    }
  };

  const confirmPaymentCollected = () => {
    if (!task || working) return;
    Alert.alert(
      "Confirm payment collected",
      `Record ${formatNaira(task.paidAmount)} as paid? Your account will be permanently attached to this audit record.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Record payment", onPress: async () => {
          setWorking(true);
          const result = await markDriverOrderPaid(task.id);
          setWorking(false);
          if (!result.success) { Alert.alert("Payment not recorded", result.message); return; }
          await load();
        } },
      ],
    );
  };

  const contact = async (kind: "call" | "sms") => {
    if (!task || contacting) return;
    setContacting(kind);
    const result = await startDriverCustomerContact(task.id, kind);
    setContacting(null);
    if (!result.success || !result.data?.uri) {
      setToast({ id: Date.now(), title: kind === "call" ? "Call unavailable" : "Text unavailable", message: result.message || "Customer contact could not be opened.", tone: "error" });
      return;
    }
    try { await Linking.openURL(result.data.uri); }
    catch { setToast({ id: Date.now(), title: "Couldn’t open this action", message: kind === "call" ? "No dialer is available on this device." : "No messaging app is available on this device.", tone: "error" }); }
  };

  const openExternalNavigation = useCallback(async () => {
    if (!task) return;
    const destination = customerPoint
      ? `${customerPoint.latitude},${customerPoint.longitude}`
      : task.address;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    try { await Linking.openURL(url); }
    catch { setToast({ id: Date.now(), title: "Couldn’t open Maps", message: "Copy the service address and open it in your preferred navigation app.", tone: "error" }); }
  }, [customerPoint, task]);

  if (loading) return <LinearGradient colors={["#26104B", "#100621", "#07030F"]} style={styles.container}><SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#B887F0" /><Text style={styles.stateText}>Loading task…</Text></SafeAreaView></LinearGradient>;
  if (!task || error) return <LinearGradient colors={["#26104B", "#100621", "#07030F"]} style={styles.container}><SafeAreaView style={styles.center}><Ionicons name="alert-circle-outline" size={36} color="#FF9BB2" /><Text style={styles.stateTitle}>Task unavailable</Text><Text style={styles.stateText}>{error || "This task is no longer in the active queue."}</Text><SoftPressable onPress={() => router.back()} style={styles.backToTasks}><Text style={styles.backToTasksText}>Back to Tasks</Text></SoftPressable></SafeAreaView></LinearGradient>;

  return (
    <LinearGradient colors={["#26104B", "#100621", "#07030F"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.header}><SoftPressable onPress={() => router.back()} style={styles.roundButton}><Ionicons name="chevron-back" size={20} color="#FFFFFF" /></SoftPressable><View style={styles.headerCopy}><Text style={styles.kicker}>{task.type.toUpperCase()} TASK</Text><Text style={styles.headerTitle}>#{task.orderId}</Text></View><View style={[styles.statusPill, task.status === "completed" && styles.completedPill]}><Text style={styles.statusText}>{task.status.toUpperCase()}</Text></View></View>

        <View style={styles.mapFrame}><MapView key={mapHealth.renderKey} ref={mapRef} provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={{ ...mapCenter, latitudeDelta: 0.055, longitudeDelta: 0.055 }} loadingEnabled loadingBackgroundColor="#171022" loadingIndicatorColor="#B887F0" onMapReady={() => fitMap(mapRef.current)} onMapLoaded={mapHealth.markLoaded}>{hasDriverLocation ? <Marker coordinate={driverPoint} title={sharing ? "Your live location" : "Last driver location"}><View style={[styles.driverMarker, !sharing && styles.pausedMarker]}><Ionicons name="car-sport" size={14} color="#FFFFFF" /></View></Marker> : null}{customerPoint ? <Marker coordinate={customerPoint} title={task.customerName}><View style={[styles.customerMarker, task.type === "delivery" && styles.deliveryMarker]}><Ionicons name="location" size={14} color="#FFFFFF" /></View></Marker> : null}{mapRoute.length > 1 ? <Polyline coordinates={mapRoute} strokeColor="#7C2BC2" strokeWidth={5} lineCap="round" lineJoin="round" /> : null}</MapView>{!customerPoint ? <MapUnavailableOverlay dark title="Service location needs attention" message="This order has an address but no verified coordinates. Operations must repair it before the task can be accepted." onOpenExternal={() => void openExternalNavigation()} /> : mapHealth.timedOut ? <MapUnavailableOverlay dark message="Google map tiles did not load. Retry here or continue safely in Google Maps." onRetry={mapHealth.retry} onOpenExternal={() => void openExternalNavigation()} /> : null}<View style={styles.mapOverlay}><Ionicons name={mapRoute.length > 1 ? "navigate" : liveTracking.loading ? "sync" : "information-circle-outline"} size={14} color="#D6B4FF" /><Text style={styles.mapOverlayText}>{!customerPoint ? "Verified destination unavailable" : mapRoute.length > 1 ? `${liveTracking.route?.distanceMeters ? `${(liveTracking.route.distanceMeters / 1000).toFixed(1)} km · ` : ""}${liveTracking.route?.durationSeconds ? `${Math.max(1, Math.round(liveTracking.route.durationSeconds / 60))} min` : "Best road route"}` : liveTracking.loading ? "Loading journey details…" : liveTracking.error || "Start the live journey to calculate a road route"}</Text></View>{customerPoint ? <SoftPressable onPress={() => setFullScreenMap(true)} style={styles.expandMap}><Ionicons name="expand-outline" size={19} color="#FFFFFF" /></SoftPressable> : null}</View>

        <View style={styles.sheet}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <View style={styles.handle} /><View style={styles.customerRow}><View style={styles.customerAvatar}><Text style={styles.customerInitial}>{task.customerName.charAt(0).toUpperCase()}</Text></View><View style={styles.customerCopy}><Text style={styles.customerName}>{task.customerName}</Text><Text style={styles.customerPhone}>{task.phoneNumber || "Secure customer contact"}</Text></View>{task.status !== "completed" ? <View style={styles.contactRow}><SoftPressable disabled={Boolean(contacting)} onPress={() => void contact("call")} style={styles.contactButton}>{contacting === "call" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="call" size={17} color="#FFFFFF" />}</SoftPressable><SoftPressable disabled={Boolean(contacting)} onPress={() => void contact("sms")} style={styles.contactButton}>{contacting === "sms" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="chatbubble" size={16} color="#FFFFFF" />}</SoftPressable></View> : null}</View>
          <View style={styles.addressCard}><Ionicons name="location-outline" size={21} color="#B887F0" /><View style={styles.addressCopy}><Text style={styles.fieldLabel}>SERVICE ADDRESS</Text><Text style={styles.address}>{task.address}</Text></View></View>
          {task.status !== "available" && task.status !== "completed" ? <SoftPressable onPress={() => sharing ? void stopDriverLocationSharing(task.id).then(() => { setSharing(false); setBackgroundEnabled(false); }) : setShowLocationDisclosure(true)} style={[styles.sharingCard, sharing && styles.sharingCardActive]}><View style={styles.sharingIcon}><Ionicons name={sharing ? "radio" : "location-outline"} size={18} color={sharing ? "#53D5A5" : "#D6B4FF"} /></View><View style={styles.sharingCopy}><Text style={styles.sharingTitle}>{sharing ? "Live location is on" : "Start live journey"}</Text><Text style={styles.sharingBody}>{sharing ? (publisher.error || `Customer can follow this journey${backgroundEnabled ? " even when the app is in the background" : " while this screen remains active"}.`) : "Required so the customer can see your arrival progress."}</Text></View><Ionicons name={sharing ? "pause-circle-outline" : "chevron-forward"} size={21} color="#D6B4FF" /></SoftPressable> : null}
          <View style={styles.detailGrid}><View style={styles.detailCard}><Ionicons name="time-outline" size={19} color="#B887F0" /><Text style={styles.fieldLabel}>TIME WINDOW</Text><Text style={styles.detailValue}>{task.timeSlot}</Text></View><View style={styles.detailCard}><Ionicons name={task.isExpress ? "flash" : "calendar-outline"} size={19} color={task.isExpress ? "#F2AC3C" : "#B887F0"} /><Text style={styles.fieldLabel}>SERVICE</Text><Text style={styles.detailValue}>{task.isExpress ? "24h Express" : "72h Standard"}</Text></View></View>
          {task.paymentStatus === "unpaid" ? <View style={styles.paymentDueCard}><View style={styles.paymentDueIcon}><Ionicons name="cash-outline" size={19} color="#F2AC3C" /></View><View style={styles.paymentDueCopy}><Text style={styles.paymentDueTitle}>PAY ON DELIVERY</Text><Text style={styles.paymentDueBody}>{formatNaira(task.paidAmount)} must be recorded before delivery is completed.</Text></View>{task.assignedToMe ? <SoftPressable onPress={confirmPaymentCollected} disabled={working} style={styles.paymentDueButton}><Text style={styles.paymentDueButtonText}>Mark paid</Text></SoftPressable> : null}</View> : null}
          <View style={styles.itemsCard}><View style={styles.itemsHeader}><Text style={styles.itemsTitle}>Garments</Text><Text style={styles.amount} adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1}>{formatNaira(task.paidAmount)}</Text></View>{task.lineItems.length ? task.lineItems.map((item) => <View key={`${item.id}-${item.name}`} style={styles.itemRow}><Text style={styles.quantity}>{item.quantity}×</Text><Text style={styles.itemName}>{item.name}</Text></View>) : <Text style={styles.noItems}>No garment details were attached.</Text>}</View>
          <SoftPressable onPress={action ? () => void handleAction() : () => router.back()} style={[styles.actionButton, !action && styles.doneButton, working && styles.disabled]}>{working ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.actionText}>{action?.label ?? "Back to Tasks"}</Text><Ionicons name={action ? "arrow-forward" : "checkmark"} size={19} color="#FFFFFF" /></>}</SoftPressable>
        </ScrollView></View>
        <ConfirmationDialog visible={showLocationDisclosure} title="Background location for this journey" message={BACKGROUND_LOCATION_DISCLOSURE} confirmLabel="Start journey" busy={startingLocation} onCancel={() => setShowLocationDisclosure(false)} onConfirm={() => void beginLocationSharing()} />
        <Modal visible={fullScreenMap} animationType="slide" onRequestClose={() => setFullScreenMap(false)}><View style={styles.fullMap}><MapView key={fullMapHealth.renderKey} ref={fullMapRef} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={{ ...(customerPoint ?? mapCenter), latitudeDelta: 0.04, longitudeDelta: 0.04 }} loadingEnabled loadingBackgroundColor="#171022" loadingIndicatorColor="#B887F0" onMapReady={() => fitMap(fullMapRef.current)} onMapLoaded={fullMapHealth.markLoaded}>{hasDriverLocation ? <Marker coordinate={driverPoint} title="Driver"><View style={[styles.driverMarker, !sharing && styles.pausedMarker]}><Ionicons name="car-sport" size={14} color="#FFFFFF" /></View></Marker> : null}{customerPoint ? <Marker coordinate={customerPoint} title={task.customerName}><View style={[styles.customerMarker, task.type === "delivery" && styles.deliveryMarker]}><Ionicons name="location" size={14} color="#FFFFFF" /></View></Marker> : null}{mapRoute.length > 1 ? <Polyline coordinates={mapRoute} strokeColor="#7C2BC2" strokeWidth={6} lineCap="round" lineJoin="round" /> : null}</MapView>{fullMapHealth.timedOut ? <MapUnavailableOverlay dark message="The embedded map did not load. Retry or continue in Google Maps." onRetry={fullMapHealth.retry} onOpenExternal={() => void openExternalNavigation()} /> : null}<SafeAreaView pointerEvents="box-none" style={styles.fullMapControls}><SoftPressable onPress={() => setFullScreenMap(false)} style={styles.closeMap}><Ionicons name="close" size={23} color="#FFFFFF" /></SoftPressable><View style={styles.fullMapStatus}><Ionicons name="navigate" size={16} color="#D6B4FF" /><Text style={styles.fullMapStatusText}>{mapRoute.length > 1 ? "Best road route to customer" : liveTracking.loading ? "Calculating road route…" : liveTracking.error || "Road route pending"}</Text></View><SoftPressable onPress={() => void openExternalNavigation()} style={styles.openExternalMap}><Ionicons name="open-outline" size={17} color="#FFFFFF" /><Text style={styles.openExternalMapText}>Google Maps</Text></SoftPressable></SafeAreaView></View></Modal>
        <AppToast toast={toast} topInset={12} onDismiss={dismissToast} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 }, stateTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginTop: 12 }, stateText: { color: "#B19DC4", textAlign: "center", lineHeight: 20, marginTop: 7 }, backToTasks: { marginTop: 20, backgroundColor: "#7C2BC2", borderRadius: 15, paddingHorizontal: 18, paddingVertical: 12 }, backToTasksText: { color: "#FFFFFF", fontWeight: "900" },
  header: { height: 65, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" }, roundButton: { width: 41, height: 41, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.09)", alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, marginLeft: 12 }, kicker: { color: "#B887F0", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, headerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 1 }, statusPill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(184,135,240,0.14)" }, completedPill: { backgroundColor: "rgba(32,193,132,0.14)" }, statusText: { color: "#D3B3F4", fontSize: 8, fontWeight: "900" },
  mapFrame: { flex: 0.73, marginHorizontal: 15, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, map: { ...StyleSheet.absoluteFillObject }, mapOverlay: { position: "absolute", zIndex: 24, left: 12, right: 58, top: 12, flexDirection: "row", gap: 6, alignItems: "center", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(20,8,40,0.86)" }, mapOverlayText: { flex: 1, color: "#E3D6F0", fontSize: 10, fontWeight: "700" }, expandMap: { position: "absolute", zIndex: 24, right: 12, top: 12, width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,8,40,0.88)" }, driverMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#7C2BC2", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }, customerMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#B05AE9", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }, deliveryMarker: { backgroundColor: "#149A6E" }, fullMap: { flex: 1, backgroundColor: "#100621" }, fullMapControls: { zIndex: 30, flex: 1, padding: 18, justifyContent: "space-between", alignItems: "flex-start" }, closeMap: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,8,40,0.9)" }, fullMapStatus: { alignSelf: "stretch", marginBottom: 8, minHeight: 52, borderRadius: 17, paddingHorizontal: 15, paddingRight: 125, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(20,8,40,0.92)" }, fullMapStatusText: { flex: 1, color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, openExternalMap: { position: "absolute", right: 30, bottom: 38, minHeight: 35, borderRadius: 11, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#7C2BC2" }, openExternalMapText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  pausedMarker: { backgroundColor: "#6E6478" }, sharingCard: { marginTop: 9, minHeight: 70, borderRadius: 17, padding: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(184,135,240,0.09)", borderWidth: 1, borderColor: "rgba(184,135,240,0.18)" }, sharingCardActive: { backgroundColor: "rgba(32,193,132,0.08)", borderColor: "rgba(83,213,165,0.22)" }, sharingIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" }, sharingCopy: { flex: 1, marginHorizontal: 10 }, sharingTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, sharingBody: { color: "#9D8AAD", fontSize: 9, lineHeight: 13, marginTop: 3 },
  sheet: { flex: 1.27, backgroundColor: "#17102B", borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -17, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", overflow: "hidden" }, sheetContent: { padding: 19, paddingTop: 10, paddingBottom: 24 }, handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 3, backgroundColor: "#4B3B60", marginBottom: 16 }, customerRow: { flexDirection: "row", alignItems: "center" }, customerAvatar: { width: 49, height: 49, borderRadius: 17, backgroundColor: "#7C2BC2", alignItems: "center", justifyContent: "center" }, customerInitial: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" }, customerCopy: { flex: 1, marginLeft: 11 }, customerName: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" }, customerPhone: { color: "#9D8AAD", fontSize: 11, marginTop: 3 }, contactRow: { flexDirection: "row", gap: 7 }, contactButton: { width: 39, height: 39, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.09)", alignItems: "center", justifyContent: "center" },
  addressCard: { marginTop: 15, borderRadius: 17, padding: 13, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.055)" }, addressCopy: { flex: 1, marginLeft: 10 }, fieldLabel: { color: "#8C779F", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, address: { color: "#E9E0F0", fontSize: 12, lineHeight: 17, marginTop: 3 }, detailGrid: { flexDirection: "row", gap: 9, marginTop: 9 }, detailCard: { flex: 1, minHeight: 84, borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.055)" }, detailValue: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", lineHeight: 15, marginTop: 5 }, paymentDueCard: { marginTop: 9, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(242,172,60,0.12)", borderWidth: 1, borderColor: "rgba(242,172,60,0.25)" }, paymentDueIcon: { width: 35, height: 35, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(242,172,60,0.12)" }, paymentDueCopy: { flex: 1 }, paymentDueTitle: { color: "#F2AC3C", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, paymentDueBody: { color: "#D7C4AA", fontSize: 10, lineHeight: 14, marginTop: 2 }, paymentDueButton: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "#F2AC3C" }, paymentDueButtonText: { color: "#2A1900", fontSize: 9, fontWeight: "900" }, itemsCard: { marginTop: 9, borderRadius: 16, padding: 13, backgroundColor: "rgba(255,255,255,0.055)" }, itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, itemsTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, amount: { width: 145, textAlign: "right", color: "#D4B1F4", fontSize: 13, lineHeight: 18, fontWeight: "900" }, itemRow: { flexDirection: "row", marginTop: 4 }, quantity: { color: "#B887F0", fontSize: 11, fontWeight: "900", width: 28 }, itemName: { color: "#C8B9D3", fontSize: 11 }, noItems: { color: "#9B88AB", fontSize: 11 }, actionButton: { marginTop: 14, minHeight: 53, borderRadius: 17, backgroundColor: "#7C2BC2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: LaundryTheme.colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 5 }, doneButton: { backgroundColor: "#149A6E" }, disabled: { opacity: 0.65 }, actionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", textTransform: "uppercase" },
});
