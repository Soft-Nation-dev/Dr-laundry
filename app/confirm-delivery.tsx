import { AppToast, type AppToastMessage } from "@/components/app-toast";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { PICKUP_DAY_OPTIONS, PICKUP_WINDOW_OPTIONS } from "@/constants/pricing";
import { apiRequest } from "@/lib/api-client";
import {
  type AddressSuggestion,
  getLocalPickupAvailability,
  resolvePickupAddress,
  searchPickupAddresses,
} from "@/lib/new-order-api";
import { getOrderById } from "@/lib/order-storage";
import { withTimeout } from "@/lib/promise-timeout";
import type { OrderRecord, PickupDayCode, PickupWindowCode } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function sessionToken() {
  return `delivery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ConfirmDeliveryScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const token = useRef(sessionToken());
  const requestSequence = useRef(0);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [focused, setFocused] = useState(false);
  const [day, setDay] = useState<PickupDayCode>("tomorrow");
  const [window, setWindow] = useState<Exclude<PickupWindowCode, "asap">>("afternoon");
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const availability = useMemo(() => getLocalPickupAvailability(), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const record = orderId ? await getOrderById(orderId) : null;
      if (!active) return;
      setOrder(record);
      if (record) {
        setAddress(record.deliveryAddress || record.address);
        setPlaceId(record.deliveryAddressPlaceId || record.addressPlaceId || "");
        if (record.deliveryDay) setDay(record.deliveryDay);
        if (record.deliveryWindow && record.deliveryWindow !== "asap") setWindow(record.deliveryWindow);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [orderId]);

  useEffect(() => {
    if (!focused || placeId || address.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const sequence = ++requestSequence.current;
    const timer = setTimeout(() => {
      setSearching(true);
      void withTimeout(searchPickupAddresses(address.trim(), token.current), 8_000, "Address search timed out")
        .then((result) => { if (sequence === requestSequence.current) setSuggestions(result); })
        .catch(() => {
          if (sequence === requestSequence.current) setToast({ id: Date.now(), title: "Address search paused", message: "The location service is slow. Keep typing or try again.", tone: "info" });
        })
        .finally(() => { if (sequence === requestSequence.current) setSearching(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [address, focused, placeId]);

  const selectAddress = async (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setSuggestions([]);
    setFocused(false);
    setResolving(true);
    try {
      const resolved = await withTimeout(
        resolvePickupAddress({ placeId: suggestion.id, sessionToken: token.current }),
        10_000,
        "Address confirmation timed out",
      );
      setAddress(resolved.address);
      setPlaceId(resolved.placeId);
      token.current = sessionToken();
    } catch (error) {
      setPlaceId("");
      setToast({ id: Date.now(), title: "Address not confirmed", message: error instanceof Error ? error.message : "Choose the address again.", tone: "error" });
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    if (!orderId || !order) return;
    if (order.status !== "ready-for-delivery") {
      setToast({ id: Date.now(), title: "Delivery already moved on", message: "Refresh the order. It is no longer waiting for a delivery slot.", tone: "info" });
      return;
    }
    if (!placeId) {
      setFocused(true);
      setToast({ id: Date.now(), title: "Confirm the receiving address", message: "Choose the exact address from the live suggestions before continuing.", tone: "error" });
      return;
    }
    setSubmitting(true);
    const response = await apiRequest(`/api/orders/${encodeURIComponent(orderId)}/confirm-delivery`, {
      method: "POST",
      auth: true,
      body: { deliveryDay: day, deliveryWindow: window, addressPlaceId: placeId, sessionToken: token.current },
    });
    setSubmitting(false);
    if (!response.success) {
      setToast({ id: Date.now(), title: "Delivery not confirmed", message: response.message || "Please try again.", tone: "error" });
      return;
    }
    setToast({ id: Date.now(), title: "Delivery confirmed", message: "Drivers will see the delivery only for the date, window and location you chose.", tone: "success" });
    setTimeout(() => router.replace({ pathname: "/track-order", params: { orderId } }), 700);
  };

  if (loading) return <LinearGradient colors={["#F6EEFF", "#FFFFFF"]} style={styles.center}><ActivityIndicator color={LaundryTheme.colors.primary} /></LinearGradient>;
  if (!order) return <LinearGradient colors={["#F6EEFF", "#FFFFFF"]} style={styles.center}><Text style={styles.emptyTitle}>Order unavailable</Text><SoftPressable onPress={() => router.back()} style={styles.smallButton}><Text style={styles.smallButtonText}>Go back</Text></SoftPressable></LinearGradient>;

  return (
    <LinearGradient colors={["#2B0B50", "#681DA6", "#F7F1FC"]} locations={[0, 0.31, 0.31]} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <SoftPressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></SoftPressable>
            <View style={{ flex: 1 }}><Text style={styles.kicker}>ORDER #{order.id}</Text><Text style={styles.title}>Plan your delivery</Text><Text style={styles.subtitle}>Your laundry is ready. Choose when and where it should meet you.</Text></View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.sheet}>
              <View style={styles.readyCard}><View style={styles.readyIcon}><Ionicons name="sparkles" size={21} color="#087A58" /></View><View style={{ flex: 1 }}><Text style={styles.readyTitle}>Ready, but not dispatched yet</Text><Text style={styles.readyBody}>A delivery task is released only after your confirmation.</Text></View></View>

              <Text style={styles.sectionLabel}>DELIVERY DATE</Text>
              <View style={styles.pillRow}>
                {PICKUP_DAY_OPTIONS.filter((option) => availability.some((entry) => entry.day === option.code)).map((option) => (
                  <SoftPressable key={option.code} onPress={() => setDay(option.code)} style={[styles.pill, day === option.code && styles.pillActive]}><Text style={[styles.pillText, day === option.code && styles.pillTextActive]}>{option.label}</Text></SoftPressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>RECEIVING WINDOW</Text>
              <View style={styles.windowRow}>
                {PICKUP_WINDOW_OPTIONS.filter((option) => option.code !== "asap" && availability.find((entry) => entry.day === day)?.windows.includes(option.code as "morning" | "afternoon")).map((option) => (
                  <SoftPressable key={option.code} onPress={() => setWindow(option.code as "morning" | "afternoon")} style={[styles.windowCard, window === option.code && styles.windowCardActive]}><Ionicons name={option.code === "morning" ? "sunny-outline" : "moon-outline"} size={20} color={window === option.code ? "#FFFFFF" : "#681DA6"} /><Text style={[styles.windowTitle, window === option.code && styles.windowTitleActive]}>{option.label}</Text></SoftPressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>RECEIVING ADDRESS</Text>
              <Text style={styles.hint}>Your pickup address is selected by default. Tap it to change.</Text>
              <View style={[styles.addressCard, placeId && styles.addressConfirmed]}>
                <Ionicons name={placeId ? "location" : "search-outline"} size={19} color="#681DA6" />
                <TextInput value={address} onChangeText={(value) => { setAddress(value); setPlaceId(""); setFocused(true); }} onFocus={() => setFocused(true)} style={styles.input} multiline placeholder="Search a delivery address" placeholderTextColor="#9B8DA4" />
                {searching || resolving ? <ActivityIndicator size="small" color="#681DA6" /> : placeId ? <Ionicons name="checkmark-circle" size={21} color="#087A58" /> : null}
              </View>
              {focused && !placeId && suggestions.length ? <View style={styles.suggestions}>{suggestions.map((suggestion) => <SoftPressable key={suggestion.id} onPress={() => void selectAddress(suggestion)} style={styles.suggestion}><Ionicons name="pin-outline" size={16} color="#681DA6" /><View style={{ flex: 1 }}><Text style={styles.suggestionMain}>{suggestion.mainText}</Text><Text style={styles.suggestionSub} numberOfLines={1}>{suggestion.secondaryText}</Text></View></SoftPressable>)}</View> : null}

              <SoftPressable disabled={submitting} onPress={() => void submit()} style={[styles.confirm, submitting && { opacity: 0.6 }]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.confirmText}>Confirm delivery plan</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></>}</SoftPressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <AppToast toast={toast} onDismiss={() => setToast(null)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  header: { minHeight: 205, paddingHorizontal: 20, paddingTop: 10, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  back: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  kicker: { color: "#DCC6F2", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginTop: 3 }, title: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", marginTop: 6 }, subtitle: { color: "#E6D7F3", fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 290 },
  content: { flexGrow: 1 }, sheet: { minHeight: 610, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingBottom: 40, backgroundColor: "#FBF9FD" },
  readyCard: { flexDirection: "row", gap: 11, padding: 14, borderRadius: 19, backgroundColor: "#ECFBF5", borderWidth: 1, borderColor: "#C2ECDC" }, readyIcon: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#D7F5E9" }, readyTitle: { color: "#075D45", fontSize: 13.5, fontWeight: "900" }, readyBody: { color: "#47796A", fontSize: 11, lineHeight: 16, marginTop: 3 },
  sectionLabel: { color: "#55465E", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1, marginTop: 22, marginBottom: 9 }, hint: { color: "#918398", fontSize: 10.5, marginTop: -4, marginBottom: 9 },
  pillRow: { flexDirection: "row", gap: 8 }, pill: { flex: 1, minHeight: 45, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E0D5E7", backgroundColor: "#FFFFFF" }, pillActive: { backgroundColor: "#681DA6", borderColor: "#681DA6" }, pillText: { color: "#685B70", fontSize: 11.5, fontWeight: "800" }, pillTextActive: { color: "#FFFFFF" },
  windowRow: { flexDirection: "row", gap: 10 }, windowCard: { flex: 1, minHeight: 71, borderRadius: 18, padding: 13, gap: 7, borderWidth: 1, borderColor: "#E2D7E9", backgroundColor: "#FFFFFF" }, windowCardActive: { backgroundColor: "#681DA6", borderColor: "#681DA6" }, windowTitle: { color: "#44364C", fontSize: 11.5, fontWeight: "900" }, windowTitleActive: { color: "#FFFFFF" },
  addressCard: { minHeight: 62, borderRadius: 18, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1.5, borderColor: "#DFD2E7", backgroundColor: "#FFFFFF" }, addressConfirmed: { borderColor: "#9DDDC6", backgroundColor: "#F7FFFB" }, input: { flex: 1, color: "#33263B", fontSize: 12.5, fontWeight: "700", paddingVertical: 12, maxHeight: 82 },
  suggestions: { marginTop: 6, borderRadius: 18, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4D9EA" }, suggestion: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEE7F2" }, suggestionMain: { color: "#3B2E43", fontSize: 12, fontWeight: "800" }, suggestionSub: { color: "#94879C", fontSize: 10, marginTop: 2 },
  confirm: { marginTop: 24, minHeight: 58, borderRadius: 18, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#681DA6", ...LaundryTheme.shadow.strong }, confirmText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, emptyTitle: { color: "#32253A", fontSize: 18, fontWeight: "900" }, smallButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: "#681DA6" }, smallButtonText: { color: "#FFFFFF", fontWeight: "900" },
});
