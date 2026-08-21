import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  getPaymentHistory,
  PaymentHistoryItem,
  PaymentStatus,
  startOrderPayment,
  verifyPayment,
} from "@/lib/payment-history-api";
import { formatNaira } from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

type Filter = "all" | "pending" | "paid";

function secondsUntil(iso: string | null, now: number) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));
}

function countdownLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function effectiveStatus(item: PaymentHistoryItem, now: number): PaymentStatus {
  return item.status === "pending" && secondsUntil(item.expiresAt, now) === 0
    ? "expired"
    : item.status;
}

function formatPaymentDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusConfig(status: PaymentStatus) {
  if (status === "paid") return { label: "Paid", icon: "checkmark-circle" as const, color: "#0C8A63", bg: "#E8FBF4" };
  if (status === "unpaid") return { label: "Pay on delivery", icon: "cash-outline" as const, color: "#9A5A00", bg: "#FFF4D8" };
  if (status === "pending") return { label: "Awaiting payment", icon: "time" as const, color: "#9A6500", bg: "#FFF7DE" };
  if (status === "failed") return { label: "Failed", icon: "close-circle" as const, color: "#B83B55", bg: "#FFF0F3" };
  return { label: "Expired", icon: "timer-outline" as const, color: "#6F6280", bg: "#F1EDF5" };
}

function isTerminalUrl(url: string) {
  return url.startsWith("https://standard.paystack.co/close") ||
    url.includes("paystack-callback") ||
    url.includes("payment/callback");
}

export default function PaymentHistoryScreen() {
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [checkout, setCheckout] = useState<PaymentHistoryItem | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [startingOrderId, setStartingOrderId] = useState<string | null>(null);
  const handledReference = useRef<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setPayments(await getPaymentHistory());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load payment history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      const topic = `customer-payments-${data.user.id}`;
      const oldChannels = supabase.getChannels().filter((item) => item.topic === `realtime:${topic}`);
      await Promise.all(oldChannels.map((item) => supabase.removeChannel(item)));
      if (!active) return;
      const next = supabase.channel(topic);
      next.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${data.user.id}` },
        () => { void load(); },
      );
      channel = next;
      next.subscribe();
    }).catch(() => undefined);
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  const visiblePayments = useMemo(() => payments.filter((payment) => {
    const status = effectiveStatus(payment, now);
    if (filter === "pending") return status === "pending" || status === "unpaid";
    if (filter === "paid") return status === "paid";
    return true;
  }), [filter, now, payments]);

  const paidTotal = useMemo(
    () => payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );
  const pendingCount = payments.filter((payment) => ["pending", "unpaid"].includes(effectiveStatus(payment, now))).length;

  const payOutstandingOrder = useCallback(async (payment: PaymentHistoryItem) => {
    setStartingOrderId(payment.id);
    setError("");
    try {
      const session = await startOrderPayment(payment.id);
      handledReference.current = null;
      setCheckout({
        ...payment,
        reference: session.reference,
        authorizationUrl: session.authorization_url,
        expiresAt: session.payment_expires_at,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment could not be started");
    } finally {
      setStartingOrderId(null);
    }
  }, []);

  const finishVerification = useCallback(async (payment: PaymentHistoryItem) => {
    if (handledReference.current === payment.reference) return;
    handledReference.current = payment.reference;
    setCheckout(null);
    setVerifying(true);
    setNotice("");
    try {
      await verifyPayment(payment.reference);
      setNotice("Payment confirmed. Your pickup is now active.");
      await load();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Payment could not be verified");
    } finally {
      setVerifying(false);
      handledReference.current = null;
    }
  }, [load]);

  return (
    <LinearGradient colors={["#F5EFFC", "#ECE4F8"]} style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <SoftPressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={22} color={LaundryTheme.colors.ink} />
          </SoftPressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YOUR WALLET</Text>
            <Text style={styles.title}>Payment History</Text>
          </View>
          <View style={styles.iconButton}>
            <Ionicons name="receipt-outline" size={21} color={LaundryTheme.colors.primary} />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[LaundryTheme.colors.primary]} />}
        >
          <LinearGradient colors={["#3D0B6B", "#661AB0"]} style={styles.summaryCard}>
            <View style={styles.summaryOrb} />
            <Text style={styles.summaryLabel}>TOTAL SUCCESSFUL PAYMENTS</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryAmount}>{formatNaira(paidTotal)}</Text>
            <View style={styles.summaryMeta}>
              <View style={styles.summaryPill}><Ionicons name="checkmark-circle" size={15} color="#A7F3D0" /><Text style={styles.summaryPillText}>{payments.filter((item) => item.status === "paid").length} paid</Text></View>
              <View style={styles.summaryPill}><Ionicons name="time" size={15} color="#FDE68A" /><Text style={styles.summaryPillText}>{pendingCount} awaiting</Text></View>
            </View>
          </LinearGradient>

          {notice ? <View style={styles.notice}><Ionicons name="checkmark-circle" size={18} color="#0C8A63" /><Text style={styles.noticeText}>{notice}</Text></View> : null}
          {error ? <SoftPressable onPress={() => load()} style={styles.error}><Ionicons name="cloud-offline-outline" size={18} color="#B83B55" /><Text style={styles.errorText}>{error}</Text><Text style={styles.retry}>Retry</Text></SoftPressable> : null}

          <View style={styles.filters}>
            {(["all", "pending", "paid"] as Filter[]).map((value) => (
              <SoftPressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === "all" ? "All" : value === "pending" ? "Awaiting" : "Paid"}</Text>
              </SoftPressable>
            ))}
          </View>

          {loading && !payments.length ? <ActivityIndicator size="large" color={LaundryTheme.colors.primary} style={styles.loader} /> : null}
          {!loading && !visiblePayments.length ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={30} color={LaundryTheme.colors.primary} /></View>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>Your completed, pending, and expired payment attempts will appear here.</Text>
            </View>
          ) : null}

          {visiblePayments.map((payment) => {
            const status = effectiveStatus(payment, now);
            const config = statusConfig(status);
            const remaining = secondsUntil(payment.expiresAt, now);
            return (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentTop}>
                  <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                    <Ionicons name={config.icon} size={16} color={config.color} />
                    <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatPaymentDate(payment.paidAt || payment.createdAt)}</Text>
                </View>
                <View style={styles.amountRow}>
                  <View style={styles.orderIcon}><Ionicons name={payment.isExpress ? "flash" : "shirt-outline"} size={22} color={LaundryTheme.colors.primaryDark} /></View>
                  <View style={styles.amountCopy}>
                    <Text style={styles.orderId}>Order {payment.id}</Text>
                    <Text style={styles.orderMeta}>{payment.isExpress ? "Express · 24 hours" : "Standard · 72 hours"}</Text>
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>{formatNaira(payment.amount)}</Text>
                </View>
                <View style={styles.referenceRow}>
                  <Text style={styles.referenceLabel}>Reference</Text>
                  <Text numberOfLines={1} style={styles.reference}>{payment.reference}</Text>
                </View>
                {status === "pending" ? (
                  <View style={styles.pendingActionRow}>
                    <View style={styles.countdownBlock}>
                      <Text style={styles.countdownLabel}>AUTO-CANCELS IN</Text>
                      <Text style={styles.countdown}>{countdownLabel(remaining)}</Text>
                    </View>
                    <SoftPressable
                      onPress={() => payment.authorizationUrl && setCheckout(payment)}
                      disabled={!payment.authorizationUrl}
                      style={[styles.payButton, !payment.authorizationUrl && styles.payButtonDisabled]}
                    >
                      <Ionicons name="lock-closed" size={15} color="#FFFFFF" />
                      <Text style={styles.payButtonText}>Continue payment</Text>
                    </SoftPressable>
                  </View>
                ) : null}
                {status === "unpaid" ? (
                  <View style={styles.unpaidActionRow}>
                    <View style={styles.unpaidCopy}>
                      <Text style={styles.countdownLabel}>AMOUNT DUE ON DELIVERY</Text>
                      <Text style={styles.unpaidHint}>You can still pay securely now.</Text>
                    </View>
                    <SoftPressable
                      onPress={() => void payOutstandingOrder(payment)}
                      disabled={startingOrderId === payment.id}
                      style={styles.payButton}
                    >
                      {startingOrderId === payment.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="card-outline" size={15} color="#FFFFFF" />}
                      <Text style={styles.payButtonText}>Pay now</Text>
                    </SoftPressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {verifying ? <View style={styles.verifyingOverlay}><View style={styles.verifyingCard}><ActivityIndicator size="large" color={LaundryTheme.colors.primary} /><Text style={styles.verifyingTitle}>Confirming payment…</Text><Text style={styles.verifyingBody}>Paystack and Dr Laundry are securely matching this transaction.</Text></View></View> : null}

        <Modal visible={Boolean(checkout)} animationType="slide" onRequestClose={() => setCheckout(null)}>
          <SafeAreaView style={styles.checkoutScreen} edges={["top", "bottom"]}>
            <View style={styles.checkoutHeader}>
              <SoftPressable onPress={() => setCheckout(null)} style={styles.iconButton}><Ionicons name="close" size={23} color={LaundryTheme.colors.ink} /></SoftPressable>
              <Text style={styles.checkoutTitle}>Secure payment</Text>
              <Ionicons name="lock-closed" size={18} color={LaundryTheme.colors.success} />
            </View>
            {checkout?.authorizationUrl ? (
              <WebView
                source={{ uri: checkout.authorizationUrl }}
                onNavigationStateChange={({ url }) => { if (isTerminalUrl(url)) void finishVerification(checkout); }}
                onError={() => setError("Paystack could not load. Close checkout and try again.")}
                startInLoadingState
                renderLoading={() => <ActivityIndicator size="large" color={LaundryTheme.colors.primary} style={StyleSheet.absoluteFillObject} />}
              />
            ) : null}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", ...LaundryTheme.shadow.soft },
  headerCopy: { flex: 1 },
  eyebrow: { color: LaundryTheme.colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: LaundryTheme.colors.ink, fontSize: 24, fontWeight: "900", marginTop: 1 },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32 },
  summaryCard: { borderRadius: 25, padding: 20, overflow: "hidden", ...LaundryTheme.shadow.strong },
  summaryOrb: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)", right: -45, top: -65 },
  summaryLabel: { color: "rgba(255,255,255,0.68)", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  summaryAmount: { color: "#FFFFFF", fontSize: 35, fontWeight: "900", marginTop: 6 },
  summaryMeta: { flexDirection: "row", gap: 8, marginTop: 15 },
  summaryPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.13)" },
  summaryPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  notice: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#E8FBF4", borderRadius: 14, padding: 12 },
  noticeText: { flex: 1, color: "#086B4E", fontSize: 12, fontWeight: "700" },
  error: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF0F3", borderRadius: 14, padding: 12 },
  errorText: { flex: 1, color: "#8A3045", fontSize: 12 },
  retry: { color: "#B83B55", fontWeight: "900", fontSize: 12 },
  filters: { marginTop: 16, padding: 4, borderRadius: 16, flexDirection: "row", backgroundColor: "rgba(76,16,125,0.08)" },
  filter: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  filterActive: { backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.soft },
  filterText: { color: LaundryTheme.colors.muted, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: LaundryTheme.colors.primaryDark },
  loader: { marginTop: 60 },
  emptyCard: { marginTop: 18, borderRadius: 22, padding: 28, backgroundColor: "rgba(255,255,255,0.86)", alignItems: "center" },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  emptyTitle: { marginTop: 12, color: LaundryTheme.colors.ink, fontSize: 17, fontWeight: "900" },
  emptyBody: { marginTop: 5, color: LaundryTheme.colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  paymentCard: { marginTop: 13, padding: 16, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(226,214,244,0.8)", ...LaundryTheme.shadow.soft },
  paymentTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 10, fontWeight: "900" },
  dateText: { flex: 1, color: LaundryTheme.colors.muted, fontSize: 10, fontWeight: "600", textAlign: "right" },
  amountRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 },
  orderIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  amountCopy: { flex: 1, minWidth: 0 },
  orderId: { color: LaundryTheme.colors.ink, fontSize: 14, fontWeight: "900" },
  orderMeta: { color: LaundryTheme.colors.muted, fontSize: 11, fontWeight: "600", marginTop: 3 },
  amount: { maxWidth: "35%", color: LaundryTheme.colors.primaryDark, fontSize: 20, fontWeight: "900", textAlign: "right" },
  referenceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F0EAF7" },
  referenceLabel: { color: LaundryTheme.colors.muted, fontSize: 10, fontWeight: "700" },
  reference: { flex: 1, textAlign: "right", color: LaundryTheme.colors.ink, fontSize: 11, fontWeight: "800" },
  pendingActionRow: { marginTop: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  unpaidActionRow: { marginTop: 13, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#F2E9D3" },
  unpaidCopy: { flex: 1 },
  unpaidHint: { color: LaundryTheme.colors.muted, fontSize: 10.5, marginTop: 3 },
  countdownBlock: { flex: 1 },
  countdownLabel: { color: LaundryTheme.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  countdown: { color: LaundryTheme.colors.primaryDark, fontSize: 18, fontWeight: "900", marginTop: 1, fontVariant: ["tabular-nums"] },
  payButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: LaundryTheme.colors.primary },
  payButtonDisabled: { opacity: 0.45 },
  payButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  verifyingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(24,9,45,0.52)", alignItems: "center", justifyContent: "center", padding: 28 },
  verifyingCard: { width: "100%", maxWidth: 340, borderRadius: 24, padding: 28, backgroundColor: "#FFFFFF", alignItems: "center" },
  verifyingTitle: { marginTop: 13, color: LaundryTheme.colors.ink, fontSize: 17, fontWeight: "900" },
  verifyingBody: { marginTop: 5, color: LaundryTheme.colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  checkoutScreen: { flex: 1, backgroundColor: "#FFFFFF" },
  checkoutHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EEE7F5" },
  checkoutTitle: { color: LaundryTheme.colors.ink, fontSize: 16, fontWeight: "900" },
});
