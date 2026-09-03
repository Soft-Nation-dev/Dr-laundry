import { SoftPressable } from "@/components/soft-pressable";
import { AppToast, type AppToastMessage } from "@/components/app-toast";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { LaundryTheme } from "@/constants/laundry-theme";
import { createReviewOrder, getAdminOrders, markAdminOrderPaid, performAdminOrderAction, type AdminOrder, type StaffOrderAction } from "@/lib/admin-api";
import { formatDayOnly, formatNaira, getOrderStatusLabel } from "@/lib/pricing";
import { getProfile } from "@/lib/profile-api";
import { canViewAdminOrders } from "@/lib/role-routing";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRole } from "@/types/profile";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "available" | "active" | "completed" | "cancelled";
const tabs: { key: Tab; label: string }[] = [{ key: "available", label: "Available" }, { key: "active", label: "Active" }, { key: "completed", label: "Done" }, { key: "cancelled", label: "Cancelled" }];

function belongsToTab(order: AdminOrder, tab: Tab) {
  if (tab === "available") return order.availableToDrivers && !order.driverId && !["delivered", "cancelled"].includes(order.status);
  if (tab === "completed") return order.status === "delivered";
  if (tab === "cancelled") return order.status === "cancelled";
  return !["delivered", "cancelled"].includes(order.status) && (!order.availableToDrivers || Boolean(order.driverId));
}

type OrderUiAction = StaffOrderAction | "mark_paid";

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [tab, setTab] = useState<Tab>("available");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<AppRole>("customer");
  const [workingOrderId, setWorkingOrderId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ order: AdminOrder; action: OrderUiAction } | null>(null);
  const [cancelOrder, setCancelOrder] = useState<AdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const [reviewDialogVisible, setReviewDialogVisible] = useState(false);
  const [creatingReview, setCreatingReview] = useState(false);
  const dismissToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    setError("");
    try { setOrders(await getAdminOrders()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Orders could not be loaded."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      const profile = await getProfile();
      if (!mounted) return;
      if (!profile.success || !profile.data || !canViewAdminOrders(profile.data.role)) {
        router.replace(profile.data?.role === "driver" ? "/driver/home" as never : "/home");
        return;
      }
      setRole(profile.data.role);
      await load();
      if (!mounted) return;
      channel = supabase.channel("admin-all-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load()).subscribe();
    })();
    return () => { mounted = false; if (channel) void supabase.removeChannel(channel); };
  }, [load]);

  const visible = useMemo(() => orders.filter((order) => belongsToTab(order, tab)), [orders, tab]);

  const runAction = useCallback(async (order: AdminOrder, action: OrderUiAction, reason = "") => {
    setWorkingOrderId(order.id);
    try {
      if (action === "mark_paid") await markAdminOrderPaid(order.id);
      else await performAdminOrderAction(order.id, action, reason);
      setToast({ id: Date.now(), title: "Order updated", message: "The change was saved and added to the permanent operations audit.", tone: "success" });
      await load();
    } catch (actionError) {
      setToast({ id: Date.now(), title: "Order not updated", message: actionError instanceof Error ? actionError.message : "Please refresh and try again.", tone: "error" });
    } finally {
      setWorkingOrderId(null);
      setPendingAction(null);
    }
  }, [load]);

  const requestAction = useCallback((order: AdminOrder, action: OrderUiAction) => {
    if (action === "cancel") {
      setCancelReason("");
      setCancelOrder(order);
      return;
    }
    setPendingAction({ order, action });
  }, []);

  const startFreshReview = useCallback(async () => {
    setCreatingReview(true);
    try {
      const reviewOrderId = await createReviewOrder();
      setReviewDialogVisible(false);
      setTab("available");
      setToast({ id: Date.now(), title: "Review workflow ready", message: `${reviewOrderId} is available only in your superadmin and driver views.`, tone: "success" });
      await load();
    } catch (reason) {
      setToast({ id: Date.now(), title: "Review order not created", message: reason instanceof Error ? reason.message : "Please try again.", tone: "error" });
    } finally {
      setCreatingReview(false);
    }
  }, [load]);

  const actionCopy = pendingAction ? {
    title: pendingAction.action === "make_available" ? "Release order to drivers?" : pendingAction.action === "ready_for_delivery" ? "Mark laundry ready?" : pendingAction.action === "unassign_driver" ? "Remove the assigned driver?" : "Confirm cash payment?",
    message: pendingAction.action === "make_available" ? "Drivers will immediately see and be able to accept this order. Your name will be stamped on the release." : pendingAction.action === "ready_for_delivery" ? "The customer will be notified to confirm a convenient date, time window and receiving address. Drivers cannot accept it until then." : pendingAction.action === "unassign_driver" ? "The task will return to the open driver queue. This is restricted to superadmins." : `Record ${formatNaira(pendingAction.order.paidAmount)} as collected? This payment record cannot be changed.`,
    label: pendingAction.action === "make_available" ? "Make available" : pendingAction.action === "ready_for_delivery" ? "Mark ready" : pendingAction.action === "unassign_driver" ? "Unassign driver" : "Mark paid",
  } : null;

  return (
    <LinearGradient colors={["#F8F0FF", "#FFFFFF", "#EEE1FB"]} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}><SoftPressable onPress={() => router.canGoBack() ? router.back() : router.replace("/settings")} style={styles.back}><Ionicons name="chevron-back" size={21} color="#421161" /></SoftPressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>LIVE BACKEND</Text><Text style={styles.title}>Customer Orders</Text></View><SoftPressable onPress={() => router.push("/driver/home" as never)} style={styles.driver}><Ionicons name="car-sport-outline" size={20} color="#FFFFFF" /></SoftPressable></View>

        <View style={styles.tabs}>{tabs.map((item) => { const active = item.key === tab; const count = orders.filter((order) => belongsToTab(order, item.key)).length; return <SoftPressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{item.label}</Text><Text style={[styles.count, active && styles.activeCount]}>{count}</Text></SoftPressable>; })}</View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} tintColor="#5B168F" onRefresh={() => { setRefreshing(true); void load(); }} />}>
          {role === "superadmin" ? <View style={styles.reviewBanner}><View style={styles.reviewIcon}><Ionicons name="shield-checkmark-outline" size={21} color="#FFFFFF" /></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Private review workflow</Text><Text style={styles.reviewText}>Create a fresh paid test order for pickup and delivery checks. It never appears to customers, drivers or admins.</Text></View><SoftPressable onPress={() => setReviewDialogVisible(true)} style={styles.reviewButton}><Text style={styles.reviewButtonText}>New</Text></SoftPressable></View> : null}
          {loading ? <State icon="sync" title="Syncing orders" detail="Loading live customer orders from Supabase…" loading /> : error ? <State icon="cloud-offline-outline" title="Couldn’t load orders" detail={error} action={() => void load()} /> : !visible.length ? <State icon="checkmark-done-circle-outline" title={`No ${tab} orders`} detail="The dashboard will update automatically when an order changes." /> : visible.map((order) => <OrderCard key={order.id} order={order} role={role} working={workingOrderId === order.id} onAction={requestAction} />)}
        </ScrollView>

        <ConfirmationDialog
          visible={Boolean(pendingAction && actionCopy)}
          title={actionCopy?.title ?? "Confirm order action"}
          message={actionCopy?.message ?? "This change will be permanently audited."}
          confirmLabel={actionCopy?.label ?? "Confirm"}
          icon={pendingAction?.action === "mark_paid" ? "cash-outline" : pendingAction?.action === "unassign_driver" ? "person-remove-outline" : "shield-checkmark-outline"}
          busy={Boolean(pendingAction && workingOrderId === pendingAction.order.id)}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => { if (pendingAction) void runAction(pendingAction.order, pendingAction.action); }}
        />

        <ConfirmationDialog
          visible={reviewDialogVisible}
          title="Start a fresh review workflow?"
          message="The current review order will leave the active queue and remain as immutable test history. A new paid pickup order will appear immediately."
          confirmLabel="Create review order"
          icon="shield-checkmark-outline"
          busy={creatingReview}
          onCancel={() => setReviewDialogVisible(false)}
          onConfirm={() => void startFreshReview()}
        />

        <Modal transparent visible={Boolean(cancelOrder)} animationType="fade" statusBarTranslucent onRequestClose={() => setCancelOrder(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.cancelOverlay}>
            <View style={styles.cancelCard}>
              <View style={styles.cancelIcon}><Ionicons name="close-circle-outline" size={27} color="#FFFFFF" /></View>
              <Text style={styles.cancelTitle}>Cancel order {cancelOrder?.id}?</Text>
              <Text style={styles.cancelBody}>The order remains permanently stored. Add a clear reason for the customer-service record.</Text>
              <TextInput
                autoFocus
                multiline
                maxLength={300}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Example: Customer requested cancellation"
                placeholderTextColor="#9B8DA4"
                style={styles.cancelInput}
              />
              <View style={styles.cancelActions}>
                <SoftPressable disabled={Boolean(workingOrderId)} onPress={() => setCancelOrder(null)} style={styles.cancelGhost}><Text style={styles.cancelGhostText}>Keep order</Text></SoftPressable>
                <SoftPressable
                  disabled={cancelReason.trim().length < 5 || Boolean(workingOrderId)}
                  onPress={() => { if (cancelOrder) void runAction(cancelOrder, "cancel", cancelReason).then(() => setCancelOrder(null)); }}
                  style={[styles.cancelPrimary, cancelReason.trim().length < 5 && styles.disabledAction]}
                >
                  {workingOrderId ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.cancelPrimaryText}>Cancel order</Text>}
                </SoftPressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <AppToast toast={toast} topInset={12} onDismiss={dismissToast} />
      </SafeAreaView>
    </LinearGradient>
  );
}

function OrderCard({ order, role, working, onAction }: { order: AdminOrder; role: AppRole; working: boolean; onAction: (order: AdminOrder, action: OrderUiAction) => void }) {
  const itemSummary = order.items.slice(0, 3).map((item) => `${item.quantity} ${item.name}`).join(", ");
  const tint = order.status === "delivered" ? "#149A6E" : order.status === "cancelled" ? "#C84A68" : order.isExpress ? "#C16B00" : "#681DA6";
  const active = !["delivered", "cancelled"].includes(order.status);
  const canRelease = active && order.locationAvailable && !order.sharedPickupOrderId && !order.availableToDrivers && !order.driverId && order.status === "pickup-confirmed" && ["paid", "unpaid"].includes(order.paymentStatus);
  const canUnassign = role === "superadmin" && Boolean(order.driverId) && order.driverTaskStatus !== "arrived";
  return <View style={styles.card}>
    <View style={styles.cardTop}><View style={[styles.statusIcon, { backgroundColor: `${tint}14` }]}><Ionicons name={order.status === "delivered" ? "checkmark-done" : order.status === "cancelled" ? "close" : order.isExpress ? "flash" : "water-outline"} size={20} color={tint} /></View><View style={styles.statusCopy}><View style={styles.statusLine}><Text style={[styles.status, { color: tint }]}>{getOrderStatusLabel(order.status).toUpperCase()}</Text>{order.isReviewOrder ? <View style={styles.reviewStamp}><Text style={styles.reviewStampText}>REVIEW</Text></View> : null}</View><Text style={styles.orderId}>#{order.id}</Text></View><View style={styles.amountBlock}><View style={[styles.paymentStamp, order.paymentStatus === "paid" ? styles.paidStamp : styles.unpaidStamp]}><Text style={[styles.paymentStampText, order.paymentStatus === "paid" ? styles.paidStampText : styles.unpaidStampText]}>{order.paymentStatus === "paid" ? "PAID" : order.paymentStatus === "unpaid" ? "UNPAID" : order.paymentStatus.toUpperCase()}</Text></View><Text style={styles.amount} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1}>{formatNaira(order.paidAmount)}</Text></View></View>
    <View style={styles.customerRow}><View style={styles.avatar}><Text style={styles.avatarText}>{order.customerName.charAt(0).toUpperCase()}</Text></View><View style={styles.customerCopy}><Text style={styles.customer}>{order.customerName}</Text><Text style={styles.contact} numberOfLines={1}>{order.customerPhone || order.customerEmail || "Customer account"}</Text></View><View style={styles.speed}><Ionicons name={order.isExpress ? "flash" : "time-outline"} size={11} color="#5B168F" /><Text style={styles.speedText}>{order.isExpress ? "24H" : "72H"}</Text></View></View>
    <Text style={styles.items} numberOfLines={2}>{itemSummary || "Laundry service"}</Text>
    <View style={styles.meta}><Ionicons name="location-outline" size={14} color="#887A91" /><Text style={styles.address} numberOfLines={1}>{order.address}</Text></View>
    {!order.locationAvailable && active ? <View style={styles.locationIssue}><Ionicons name="warning-outline" size={14} color="#B53756" /><Text style={styles.locationIssueText}>LOCATION NOT VERIFIED · CANNOT RELEASE TO DRIVERS</Text></View> : null}
    <Text style={styles.date}>Placed {formatDayOnly(order.createdAt)} · Due {formatDayOnly(order.promisedDeliveryAt)}</Text>
    <View style={[styles.releaseStamp, order.availableToDrivers || order.sharedPickupOrderId ? styles.releaseStampActive : styles.releaseStampHeld]}><Ionicons name={order.sharedPickupOrderId ? "git-merge-outline" : order.availableToDrivers ? "shield-checkmark" : "pause-circle-outline"} size={14} color={order.availableToDrivers || order.sharedPickupOrderId ? "#0C8A63" : "#8A5B00"} /><View style={{ flex: 1 }}><Text style={styles.releaseTitle}>{order.sharedPickupOrderId ? "Attached to one physical pickup" : order.availableToDrivers ? `Released by ${order.availableByName || "Operations"}` : "Held from driver queue"}</Text><Text style={styles.releaseDetail}>{order.sharedPickupOrderId ? `The driver receives this with #${order.sharedPickupOrderId}; it cannot be released twice.` : order.availableToDrivers ? `${order.availableByRole === "system" ? "Automatic after payment" : "Staff-approved dispatch"}${order.availableAt ? ` · ${formatDayOnly(order.availableAt)}` : ""}` : !order.locationAvailable ? "A verified location is required before driver release." : order.status === "ready-for-delivery" ? "Waiting for the customer to confirm delivery." : "Use Make available when the order is ready for a driver."}</Text></View></View>
    {order.sharedPickupOrderId ? <View style={styles.sharedPickupStamp}><Ionicons name="git-merge-outline" size={14} color="#087A58" /><Text style={styles.sharedPickupStampText}>Bundled pickup with #{order.sharedPickupOrderId} · {formatNaira(order.sharedPickupDiscount)} waived</Text></View> : null}
    {order.status === "cancelled" && order.cancellationReason ? <View style={styles.cancelledReason}><Text style={styles.cancelledReasonTitle}>CANCELLED BY {order.cancelledByName?.toUpperCase() || "OPERATIONS"}</Text><Text style={styles.cancelledReasonText}>{order.cancellationReason}</Text></View> : null}
    <View style={styles.actions}>
      {order.paymentStatus === "unpaid" && active ? <ActionChip label="Mark paid" icon="cash-outline" disabled={working} onPress={() => onAction(order, "mark_paid")} /> : null}
      {canRelease ? <ActionChip label="Make available" icon="car-sport-outline" primary disabled={working} onPress={() => onAction(order, "make_available")} /> : null}
      {order.status === "processing" ? <ActionChip label="Ready for delivery" icon="navigate-outline" primary disabled={working} onPress={() => onAction(order, "ready_for_delivery")} /> : null}
      {order.driverId ? <ActionChip label="Open task" icon="open-outline" primary disabled={working} onPress={() => router.push({ pathname: "/driver/task-detail" as never, params: { taskId: order.id } })} /> : null}
      {canUnassign ? <ActionChip label="Unassign" icon="person-remove-outline" disabled={working} onPress={() => onAction(order, "unassign_driver")} /> : null}
      {active && order.paymentStatus !== "pending" ? <ActionChip label="Cancel" icon="close-outline" danger disabled={working} onPress={() => onAction(order, "cancel")} /> : null}
    </View>
  </View>;
}

function ActionChip({ label, icon, onPress, disabled = false, primary = false, danger = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean; primary?: boolean; danger?: boolean }) {
  return <SoftPressable disabled={disabled} onPress={onPress} style={[styles.actionChip, primary && styles.actionChipPrimary, danger && styles.actionChipDanger, disabled && styles.disabledAction]}><Ionicons name={icon} size={14} color={primary ? "#FFFFFF" : danger ? "#A8324D" : "#5B168F"} /><Text style={[styles.actionChipText, primary && styles.actionChipPrimaryText, danger && styles.actionChipDangerText]}>{label}</Text></SoftPressable>;
}

function State({ icon, title, detail, loading = false, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; loading?: boolean; action?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator color="#681DA6" /> : <Ionicons name={icon} size={30} color="#7A37B1" />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{detail}</Text>{action ? <SoftPressable onPress={action} style={styles.retry}><Text style={styles.retryText}>Try again</Text></SoftPressable> : null}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1 }, header: { paddingHorizontal: 18, paddingTop: 12, flexDirection: "row", alignItems: "center" }, back: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8DFED" }, headerCopy: { flex: 1, marginLeft: 12 }, eyebrow: { color: "#866C96", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { color: LaundryTheme.colors.ink, fontSize: 25, fontWeight: "900", marginTop: 1 }, driver: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#5B168F" },
  tabs: { marginHorizontal: 18, marginTop: 18, padding: 4, flexDirection: "row", borderRadius: 17, backgroundColor: "#E7DEED" }, tab: { flex: 1, minHeight: 43, borderRadius: 14, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" }, activeTab: { backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.soft }, tabText: { color: "#695E70", fontSize: 10.5, fontWeight: "800" }, activeTabText: { color: "#40115E" }, count: { color: "#887C90", fontSize: 9, fontWeight: "900" }, activeCount: { color: "#7A2DB4" }, content: { padding: 18, paddingBottom: 35, gap: 13 },
  reviewBanner: { padding: 14, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2F0B4C", borderWidth: 1, borderColor: "#6D2D98" }, reviewIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#7A2DB4" }, reviewCopy: { flex: 1 }, reviewTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, reviewText: { color: "#D9C7E5", fontSize: 9.5, lineHeight: 14, marginTop: 3 }, reviewButton: { minWidth: 54, minHeight: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }, reviewButtonText: { color: "#5B168F", fontSize: 10, fontWeight: "900" },
  card: { borderRadius: 24, padding: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EBE3F0", ...LaundryTheme.shadow.soft }, cardTop: { flexDirection: "row", alignItems: "center" }, statusIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, statusCopy: { flex: 1, marginLeft: 10 }, status: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 }, orderId: { color: "#33263B", fontSize: 14, fontWeight: "900", marginTop: 3 }, amountBlock: { alignItems: "flex-end", maxWidth: 126 }, amount: { width: 126, textAlign: "right", color: "#5B168F", fontSize: 16, lineHeight: 22, fontWeight: "900", marginTop: 4 }, paymentStamp: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 }, paidStamp: { backgroundColor: "#E7FAF2", borderColor: "#9DE2C8" }, unpaidStamp: { backgroundColor: "#FFF0D2", borderColor: "#F0C46E" }, paymentStampText: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1 }, paidStampText: { color: "#087451" }, unpaidStampText: { color: "#8A5100" }, customerRow: { marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F0EAF3", flexDirection: "row", alignItems: "center" }, avatar: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F0E4FA" }, avatarText: { color: "#5B168F", fontSize: 15, fontWeight: "900" }, customerCopy: { flex: 1, marginLeft: 10 }, customer: { color: "#2C2033", fontSize: 13, fontWeight: "900" }, contact: { color: "#93889A", fontSize: 9.5, marginTop: 2 }, speed: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: "#F2E7FB" }, speedText: { color: "#5B168F", fontSize: 8, fontWeight: "900" }, items: { color: "#423648", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 12 }, meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9 }, address: { flex: 1, color: "#887A91", fontSize: 10.5 }, locationIssue: { marginTop: 8, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF0F3", borderWidth: 1, borderColor: "#F1C5D0" }, locationIssueText: { flex: 1, color: "#A8324D", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.4 }, date: { color: "#9A8FA0", fontSize: 9.5, marginTop: 7 }, releaseStamp: { marginTop: 11, borderRadius: 15, padding: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1 }, releaseStampActive: { backgroundColor: "#EEFBF6", borderColor: "#C4ECDD" }, releaseStampHeld: { backgroundColor: "#FFF8E9", borderColor: "#F0DCA8" }, releaseTitle: { color: "#3E3145", fontSize: 10.5, fontWeight: "900" }, releaseDetail: { color: "#887A91", fontSize: 9, lineHeight: 13, marginTop: 2 }, cancelledReason: { marginTop: 10, borderRadius: 14, padding: 10, backgroundColor: "#FFF0F3" }, cancelledReasonTitle: { color: "#A8324D", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 }, cancelledReasonText: { color: "#714451", fontSize: 10.5, lineHeight: 15, marginTop: 3 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }, actionChip: { minHeight: 42, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#D8C4E8", backgroundColor: "#FFFFFF" }, actionChipPrimary: { borderColor: "#5B168F", backgroundColor: "#5B168F" }, actionChipDanger: { borderColor: "#F0C4CE", backgroundColor: "#FFF3F5" }, actionChipText: { color: "#5B168F", fontSize: 10.5, fontWeight: "900" }, actionChipPrimaryText: { color: "#FFFFFF" }, actionChipDangerText: { color: "#A8324D" }, disabledAction: { opacity: 0.48 },
  sharedPickupStamp: { marginTop: 9, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#ECFBF5", borderWidth: 1, borderColor: "#C2ECDC" },
  sharedPickupStampText: { flex: 1, color: "#087A58", fontSize: 9.5, fontWeight: "900" },
  cancelOverlay: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(18,5,29,0.72)" }, cancelCard: { borderRadius: 27, padding: 21, backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.strong }, cancelIcon: { width: 53, height: 53, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#B63D59" }, cancelTitle: { marginTop: 15, color: LaundryTheme.colors.ink, fontSize: 19, fontWeight: "900" }, cancelBody: { marginTop: 6, color: LaundryTheme.colors.muted, fontSize: 12, lineHeight: 18 }, cancelInput: { minHeight: 96, marginTop: 14, borderRadius: 16, padding: 13, textAlignVertical: "top", color: LaundryTheme.colors.ink, backgroundColor: "#F8F3FA", borderWidth: 1, borderColor: "#E7D9EC" }, cancelActions: { flexDirection: "row", gap: 9, marginTop: 15 }, cancelGhost: { flex: 1, minHeight: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#F0E8F5" }, cancelGhostText: { color: LaundryTheme.colors.ink, fontWeight: "800" }, cancelPrimary: { flex: 1.25, minHeight: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#B63D59" }, cancelPrimaryText: { color: "#FFFFFF", fontWeight: "900" },
  state: { marginTop: 18, padding: 28, borderRadius: 24, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE2EF" }, stateTitle: { color: LaundryTheme.colors.ink, fontSize: 17, fontWeight: "900", marginTop: 9 }, stateText: { color: LaundryTheme.colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 5 }, retry: { marginTop: 13, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, backgroundColor: "#5B168F" }, retryText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewStamp: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: "#2F0B4C" },
  reviewStampText: { color: "#FFFFFF", fontSize: 6.5, fontWeight: "900", letterSpacing: 0.8 },
});
