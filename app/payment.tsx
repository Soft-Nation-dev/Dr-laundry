import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { MODE_OPTIONS } from "@/constants/pricing";
import { getDraft } from "@/lib/order-draft";
import { createOrderFromDraft } from "@/lib/order-storage";
import {
  formatNaira,
  getPickupDayLabel,
  getPickupWindowLabel,
  getDeliveryDayLabel,
  getDeliveryWindowLabel,
} from "@/lib/pricing";
import { OrderDraft } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function parseDraftParam(rawParam?: string | string[]): OrderDraft | null {
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (!raw) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as OrderDraft;

    if (!parsed || !Array.isArray(parsed.lineItems) || !parsed.totals) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export default function PaymentScreen() {
  const { draft } = useLocalSearchParams<{
    draft?: string;
  }>();

  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(() =>
    parseDraftParam(draft),
  );

  useEffect(() => {
    (async () => {
      const parsed = parseDraftParam(draft);
      if (parsed) {
        setOrderDraft(parsed);
        return;
      }

      const stored = await getDraft();
      if (stored) setOrderDraft(stored as OrderDraft);
    })();
  }, [draft]);
  const [showExpressModal, setShowExpressModal] = useState(false);
  const [isExpress, setIsExpress] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const introOpacity = useRef(new Animated.Value(0)).current;
  const introOffset = useRef(new Animated.Value(16)).current;
  const cardScale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
      }),
      Animated.timing(introOffset, {
        toValue: 0,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }),
    ]).start();
  }, [cardScale, introOffset, introOpacity]);

  const totalPieces = useMemo(() => {
    if (!orderDraft) {
      return 0;
    }

    return orderDraft.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [orderDraft]);

  const payableAmount = orderDraft
    ? isExpress
      ? orderDraft.totals.expressTotal
      : orderDraft.totals.standardTotal
    : 0;

  const handlePayPress = () => {
    if (!orderDraft) {
      Alert.alert(
        "Order not ready",
        "Please return to Price List and rebuild your order quote.",
      );
      return;
    }

    setShowExpressModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!orderDraft) {
      return;
    }

    try {
      setIsProcessingPayment(true);
      const order = await createOrderFromDraft(orderDraft, isExpress);

      setShowExpressModal(false);
      router.replace({
        pathname: "/pickup-map",
        params: { orderId: order.id },
      });
    } catch {
      Alert.alert(
        "Payment failed",
        "We could not create your order. Please try again.",
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <LinearGradient
      colors={[
        LaundryTheme.colors.bgStart,
        "#FFFFFF",
        LaundryTheme.colors.bgEnd,
      ]}
      style={styles.container}
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.headerBlock,
              {
                opacity: introOpacity,
                transform: [{ translateY: introOffset }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                LaundryTheme.colors.bgStart,
                LaundryTheme.colors.primary,
              ]}
              style={styles.hero}
            >
              <Ionicons name="shield-checkmark" size={28} color="#fff" />
              <Text style={styles.heroTitle}>Secure checkout</Text>
            </LinearGradient>
            <View style={styles.headerTextWrap}>
              <Text style={styles.kicker}>Secure checkout</Text>
              <Text style={styles.title}>Payment summary</Text>
              <Text style={styles.subtitle}>
                Confirm total or choose Express.
              </Text>
            </View>
            <View style={styles.lockBadge}>
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={LaundryTheme.colors.primaryDark}
              />
              <Text style={styles.lockBadgeText}>Protected</Text>
            </View>
          </Animated.View>

          {orderDraft ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: introOpacity,
                    transform: [
                      { translateY: introOffset },
                      { scale: cardScale },
                    ],
                  },
                ]}
              >
                <Text style={styles.cardTitle}>Order recap</Text>

                <View style={styles.recapRow}>
                  <Text style={styles.recapLabel}>Service mode</Text>
                  <Text style={styles.recapValue}>
                    {MODE_OPTIONS[orderDraft.mode].label}
                  </Text>
                </View>

                <View style={styles.recapRow}>
                  <Text style={styles.recapLabel}>Items</Text>
                  <Text style={styles.recapValue}>{totalPieces} pieces</Text>
                </View>

                <View style={styles.recapRow}>
                  <Text style={styles.recapLabel}>Pickup schedule</Text>
                  <Text style={styles.recapValue}>
                    {`${getPickupDayLabel(orderDraft.pickupDay)} • ${getPickupWindowLabel(
                      orderDraft.pickupWindow,
                    )}`}
                  </Text>
                </View>

                <View style={styles.recapRow}>
                  <Text style={styles.recapLabel}>Delivery schedule</Text>
                  <Text style={styles.recapValue}>
                    {orderDraft.deliveryDay && orderDraft.deliveryWindow
                      ? `${getDeliveryDayLabel(orderDraft.deliveryDay)} • ${getDeliveryWindowLabel(
                          orderDraft.deliveryWindow,
                        )}`
                      : "Standard delivery schedule"}
                  </Text>
                </View>

                <View style={styles.recapRow}>
                  <Text style={styles.recapLabel}>Pickup address</Text>
                  <Text style={styles.recapValue}>{orderDraft.address}</Text>
                </View>

                <View style={styles.divider} />

                <Row
                  label="Base subtotal"
                  value={formatNaira(orderDraft.totals.baseSubtotal)}
                />
                <Row
                  label={`${MODE_OPTIONS[orderDraft.mode].label} subtotal`}
                  value={formatNaira(orderDraft.totals.modeSubtotal)}
                />
                <Row
                  label="Pickup + Delivery"
                  value={formatNaira(orderDraft.totals.pickupDeliveryFee)}
                />
                <Row
                  label="Standard total"
                  value={formatNaira(orderDraft.totals.standardTotal)}
                  highlight
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.paymentMethod,
                  {
                    opacity: introOpacity,
                    transform: [{ translateY: introOffset }],
                  },
                ]}
              >
                <Text style={styles.methodText}>
                  Express option at pay step
                </Text>
                <Text style={styles.methodDetail}>
                  Express adds 50% +{" "}
                  {formatNaira(orderDraft.totals.expressDeliveryFee)} delivery;
                  returned within 48 hours.
                </Text>
              </Animated.View>
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={LaundryTheme.colors.warning}
              />
              <Text style={styles.emptyTitle}>Missing order draft</Text>
              <Text style={styles.emptyBody}>
                Start from Price List to generate your quote before paying.
              </Text>
              <SoftPressable
                onPress={() => router.replace("/new-order")}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>Go to Price List</Text>
              </SoftPressable>
            </View>
          )}

          <SoftPressable
            onPress={handlePayPress}
            style={[styles.payButton, !orderDraft && styles.payButtonDisabled]}
          >
            <Text style={styles.payText}>Pay {formatNaira(payableAmount)}</Text>
          </SoftPressable>
        </View>

        <Modal
          animationType="fade"
          transparent
          visible={showExpressModal}
          onRequestClose={() => setShowExpressModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose delivery speed</Text>
              <Text style={styles.modalBody}>
                Immediate pickup; 48-hour return.
              </Text>

              {orderDraft ? (
                <>
                  <SoftPressable
                    onPress={() => setIsExpress(false)}
                    style={[
                      styles.optionCard,
                      !isExpress && styles.optionCardActive,
                    ]}
                  >
                    <View style={styles.optionHeader}>
                      <Text style={styles.optionTitle}>Standard</Text>
                      {!isExpress ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={LaundryTheme.colors.primaryDark}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.optionAmount}>
                      {formatNaira(orderDraft.totals.standardTotal)}
                    </Text>
                    <Text style={styles.optionDetail}>Return in 72 hours</Text>
                  </SoftPressable>

                  <SoftPressable
                    onPress={() => setIsExpress(true)}
                    style={[
                      styles.optionCard,
                      isExpress && styles.optionCardActive,
                    ]}
                  >
                    <View style={styles.optionHeader}>
                      <Text style={styles.optionTitle}>Express Service</Text>
                      {isExpress ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={LaundryTheme.colors.primaryDark}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.optionAmount}>
                      {formatNaira(orderDraft.totals.expressTotal)}
                    </Text>
                    <Text style={styles.optionDetail}>
                      +{formatNaira(orderDraft.totals.expressPremium)} surcharge
                      and {formatNaira(orderDraft.totals.expressDeliveryFee)}{" "}
                      delivery
                    </Text>
                  </SoftPressable>
                </>
              ) : null}

              <View style={styles.modalActionRow}>
                <SoftPressable
                  onPress={() => setShowExpressModal(false)}
                  style={styles.modalGhostButton}
                >
                  <Text style={styles.modalGhostText}>Cancel</Text>
                </SoftPressable>

                <SoftPressable
                  onPress={handleConfirmPayment}
                  style={styles.modalPrimaryButton}
                >
                  {isProcessingPayment ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryText}>
                      Confirm {formatNaira(payableAmount)}
                    </Text>
                  )}
                </SoftPressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, highlight && styles.highlight]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, highlight && styles.highlight]}>
        {value}
      </Text>
    </View>
  );
}

// ONLY showing changed styles + small structure improvements
// Your logic stays the same

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 10,
  },

  scrollContent: {
    paddingBottom: 20,
  },

  // ---------- HEADER ----------
  headerBlock: {
    marginBottom: 8,
  },

  kicker: {
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: LaundryTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: 6,
    color: LaundryTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },

  hero: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  heroTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  lockBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  lockBadgeText: {
    color: LaundryTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
  },

  // ---------- CARD ----------
  card: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",

    // iOS soft depth
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    marginBottom: 14,
  },

  recapRow: {
    marginBottom: 12,
  },

  recapLabel: {
    fontSize: 11,
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
    marginBottom: 3,
  },

  recapValue: {
    fontSize: 14,
    color: LaundryTheme.colors.ink,
    fontWeight: "600",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  rowLabel: {
    color: LaundryTheme.colors.muted,
    fontSize: 13,
  },

  rowValue: {
    color: LaundryTheme.colors.ink,
    fontWeight: "600",
  },

  highlight: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "900",
    fontSize: 16,
  },

  // ---------- EXPRESS INFO ----------
  paymentMethod: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",

    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  methodText: {
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
  },

  methodDetail: {
    marginTop: 4,
    fontSize: 13,
    color: LaundryTheme.colors.muted,
  },

  // ---------- CTA ----------
  payButton: {
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",

    backgroundColor: LaundryTheme.colors.primary,

    shadowColor: LaundryTheme.colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  payText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  payButtonDisabled: {
    opacity: 0.5,
  },

  // ---------- EMPTY ----------
  emptyCard: {
    marginTop: 20,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },

  emptyTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: LaundryTheme.colors.ink,
  },

  emptyBody: {
    marginTop: 4,
    color: LaundryTheme.colors.muted,
    fontSize: 13,
  },

  emptyButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: LaundryTheme.colors.primary,
    alignSelf: "flex-start",
  },

  emptyButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  // ---------- MODAL ----------
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },

  modalCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    backgroundColor: "#fff",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
  },

  modalBody: {
    marginTop: 6,
    fontSize: 13,
    color: LaundryTheme.colors.muted,
  },

  optionCard: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    backgroundColor: "#fff",
  },

  optionCardActive: {
    borderColor: LaundryTheme.colors.primary,
    backgroundColor: LaundryTheme.colors.primarySoft,
  },

  optionTitle: {
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
  },

  optionAmount: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "900",
    color: LaundryTheme.colors.primaryDark,
  },

  optionDetail: {
    fontSize: 12,
    marginTop: 4,
    color: LaundryTheme.colors.muted,
  },

  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  modalGhostButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
  },

  modalGhostText: {
    fontWeight: "700",
    color: LaundryTheme.colors.primaryDark,
  },

  modalPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: LaundryTheme.colors.primary,
  },

  modalPrimaryText: {
    color: "#fff",
    fontWeight: "800",
  },
  headerTextWrap: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
