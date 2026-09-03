import { SoftPressable } from "@/components/soft-pressable";
import { MapUnavailableOverlay } from "@/components/map-unavailable-overlay";
import { LaundryTheme } from "@/constants/laundry-theme";
import { useLiveTracking } from "@/hooks/use-live-tracking";
import { useMapTileHealth } from "@/hooks/use-map-tile-health";
import type { MapPoint } from "@/lib/tracking-api";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

const ENUGU: MapPoint = { latitude: 6.4584, longitude: 7.5464 };

type LiveOrderMapProps = { orderId: string; height?: number; dark?: boolean };

function formatEta(seconds: number | null | undefined) {
  if (!seconds) return "Calculating";
  if (seconds < 60) return "< 1 min";
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

function formatDistance(meters: number | null | undefined) {
  if (!meters) return "Road distance pending";
  return meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
}

export function LiveOrderMap({ orderId, height = 320, dark = false }: LiveOrderMapProps) {
  const tracking = useLiveTracking(orderId);
  const mapHealth = useMapTileHealth(Boolean(tracking.snapshot?.destination));
  const mapRef = useRef<MapView>(null);
  const destination = tracking.snapshot?.destination ?? null;
  const driver = tracking.location;
  const center = destination ?? driver ?? ENUGU;
  const fallbackRoute = useMemo(() => driver && destination ? [driver, destination] : [], [destination, driver]);
  const route = tracking.routePoints.length > 1 ? tracking.routePoints : fallbackRoute;

  useEffect(() => {
    if (!mapRef.current || !driver || !destination) return;
    mapRef.current.fitToCoordinates([driver, destination, ...route], {
      edgePadding: { top: 62, right: 42, bottom: 78, left: 42 },
      animated: true,
    });
  }, [destination, driver, route]);

  const freshness = tracking.lastUpdateAgeSeconds === null
    ? "Waiting for driver"
    : tracking.stale
      ? `Last update ${Math.ceil(tracking.lastUpdateAgeSeconds / 60)}m ago`
      : tracking.lastUpdateAgeSeconds < 8 ? "Live now" : `Updated ${tracking.lastUpdateAgeSeconds}s ago`;

  return (
    <View style={[styles.frame, dark && styles.frameDark, { height }]}>
      <MapView key={mapHealth.renderKey} ref={mapRef} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={{ ...center, latitudeDelta: 0.045, longitudeDelta: 0.045 }} showsCompass={false} toolbarEnabled={false} loadingEnabled loadingBackgroundColor={dark ? "#171022" : "#F3EEF8"} loadingIndicatorColor="#7126BC" onMapLoaded={mapHealth.markLoaded}>
        {route.length > 1 ? <Polyline coordinates={route} strokeColor="#7126BC" strokeWidth={5} lineCap="round" /> : null}
        {destination ? <Marker coordinate={destination} title="Service address"><View style={styles.destinationMarker}><Ionicons name="home" size={16} color="#FFFFFF" /></View></Marker> : null}
        {driver ? <Marker coordinate={driver} rotation={driver.headingDegrees ?? 0} anchor={{ x: 0.5, y: 0.5 }} title="Your Dr Laundry driver"><View style={[styles.driverMarker, tracking.stale && styles.driverMarkerStale]}><Ionicons name="car-sport" size={17} color="#FFFFFF" /></View></Marker> : null}
      </MapView>
      {!tracking.loading && !destination ? <MapUnavailableOverlay dark={dark} title="Service location unavailable" message="This order does not have a verified map destination yet. Contact support if the order is already active." /> : mapHealth.timedOut ? <MapUnavailableOverlay dark={dark} message="Map tiles did not load. Check the connection and retry." onRetry={mapHealth.retry} /> : null}
      <View style={[styles.livePill, tracking.stale && styles.stalePill]}><View style={[styles.liveDot, tracking.stale && styles.staleDot]} /><Text style={styles.liveText}>{freshness}</Text></View>
      <View style={styles.etaCard}>
        {tracking.loading ? <ActivityIndicator color={LaundryTheme.colors.primary} /> : <><View style={styles.etaIcon}><Ionicons name={tracking.snapshot?.taskType === "delivery" ? "shirt" : "bag-handle"} size={17} color="#FFFFFF" /></View><View style={styles.etaCopy}><Text style={styles.etaLabel}>{tracking.snapshot?.taskType === "delivery" ? "Delivery arrival" : "Pickup arrival"}</Text><Text style={styles.etaValue}>{driver ? formatEta(tracking.route?.durationSeconds) : "Driver not en route yet"}</Text><Text style={styles.distance}>{formatDistance(tracking.route?.distanceMeters)}</Text></View>{tracking.error ? <SoftPressable accessibilityLabel="Retry live tracking" onPress={() => void tracking.refresh()} style={styles.retry}><Ionicons name="refresh" size={17} color={LaundryTheme.colors.primaryDark} /></SoftPressable> : null}</>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", borderRadius: 26, backgroundColor: "#EEE8F5", borderWidth: 1, borderColor: LaundryTheme.colors.border, ...LaundryTheme.shadow.soft }, frameDark: { borderColor: "rgba(255,255,255,0.08)" }, livePill: { position: "absolute", top: 12, left: 12, minHeight: 34, paddingHorizontal: 12, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(24,15,38,0.88)" }, stalePill: { backgroundColor: "rgba(89,72,55,0.9)" }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ED59F" }, staleDot: { backgroundColor: "#F2AC3C" }, liveText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" }, destinationMarker: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#17102B", borderWidth: 2, borderColor: "#FFFFFF" }, driverMarker: { width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primary, borderWidth: 3, borderColor: "#FFFFFF", elevation: 6 }, driverMarkerStale: { backgroundColor: "#786B84" }, etaCard: { position: "absolute", left: 12, right: 12, bottom: 12, minHeight: 70, borderRadius: 19, padding: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.96)", ...LaundryTheme.shadow.soft }, etaIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primary }, etaCopy: { flex: 1, marginLeft: 10 }, etaLabel: { color: LaundryTheme.colors.muted, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }, etaValue: { marginTop: 2, color: LaundryTheme.colors.ink, fontSize: 15, fontWeight: "900" }, distance: { marginTop: 2, color: LaundryTheme.colors.muted, fontSize: 10, fontWeight: "600" }, retry: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
});
