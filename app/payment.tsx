import { SoftPressable } from "@/components/soft-pressable";
import { ORDER_TRANSITION_COVER_MS, OrderTransitionOverlay } from "@/components/order-transition-overlay";
import { getGarmentImage } from "@/constants/garment-images";
import { LaundryTheme } from "@/constants/laundry-theme";
import { MODE_OPTIONS } from "@/constants/pricing";
import { apiRequest } from "@/lib/api-client";
import { clearDraft, getDraft } from "@/lib/order-draft";
import {
  formatDateTime,
  formatNaira,
  getTurnaroundHours,
  getPickupDayLabel,
  getPickupWindowLabel,
  resolvePromisedDeliveryISO,
} from "@/lib/pricing";
import { OrderDraft } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function parseDraftParam(rawParam?: string | string[]): OrderDraft | null {
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as OrderDraft;
    if (!parsed || !Array.isArray(parsed.lineItems) || !parsed.totals) return null;
    const isExpress = Boolean(parsed.isExpress);
    return {
      ...parsed,
      isExpress,
      turnaroundHours: getTurnaroundHours(isExpress),
    };
  } catch {
    return null;
  }
}

/**
 * Strictly match Paystack's terminal redirect URLs.
 * Paystack redirects to the callback_url we passed during order creation.
 * We ONLY consider the payment done when the WebView lands on one of these exact patterns.
 */
function isPaystackTerminalUrl(url: string): boolean {
  // Paystack's own close page
  if (url.startsWith("https://standard.paystack.co/close")) return true;
  // Our own callback URL (which we set to standard.paystack.co/close in the backend)
  // Also handle if the backend uses a custom callback on our own domain
  if (url.includes("paystack-callback") || url.includes("payment/callback")) return true;
  return false;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function PaymentScreen() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const routeDraft = useMemo(() => parseDraftParam(draft), [draft]);

  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(routeDraft);
  const [isExpress, setIsExpress] = useState(() =>
    Boolean(routeDraft?.isExpress),
  );

  useEffect(() => {
    (async () => {
      if (routeDraft) {
        setOrderDraft(routeDraft);
        setIsExpress(Boolean(routeDraft.isExpress));
        return;
      }
      const stored = await getDraft();
      if (stored) {
        const isExpress = Boolean(stored.isExpress);
        setOrderDraft({
          ...stored,
          isExpress,
          turnaroundHours: getTurnaroundHours(isExpress),
        });
        setIsExpress(isExpress);
      }
    })();
  }, [routeDraft]);

  const [showExpressModal, setShowExpressModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"paystack" | "pay_on_delivery">("paystack");
  const [payOnDeliveryEligible, setPayOnDeliveryEligible] = useState(false);
  const [isLoadingPaymentOptions, setIsLoadingPaymentOptions] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [webViewError, setWebViewError] = useState<string | null>(null);

  // WebView payment states
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isLeavingCheckout, setIsLeavingCheckout] = useState(false);
  const leavingRef = useRef(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether we've already handled the terminal URL to prevent double-fires
  const paymentHandledRef = useRef(false);
  // Track if the WebView was open when the app went to background (AppState)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const manualVerifyRef = useRef<() => void>(() => undefined);

  // Entry animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const modalSlide = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 5 }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  useEffect(() => {
    if (showExpressModal) {
      modalSlide.setValue(300);
      Animated.spring(modalSlide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
    }
  }, [showExpressModal, modalSlide]);

  useEffect(() => {
    if (!showExpressModal) return;
    let active = true;
    setIsLoadingPaymentOptions(true);
    apiRequest<{ payOnDeliveryEligible: boolean }>("/api/orders/payment-options", { auth: true })
      .then((response) => {
        if (!active) return;
        const eligible = Boolean(response.success && response.data?.payOnDeliveryEligible);
        setPayOnDeliveryEligible(eligible);
        if (!eligible) setPaymentMethod("paystack");
      })
      .finally(() => {
        if (active) setIsLoadingPaymentOptions(false);
      });
    return () => { active = false; };
  }, [showExpressModal]);

  const dismissCheckoutSheet = useCallback(() => new Promise<void>((resolve) => {
    Animated.timing(modalSlide, {
      toValue: 420,
      duration: 190,
      easing: (value) => value * value,
      useNativeDriver: true,
    }).start(() => {
      setShowExpressModal(false);
      requestAnimationFrame(() => resolve());
    });
  }), [modalSlide]);

  // ── AppState Recovery Handler ──────────────────
  // If the user backgrounds the app mid-payment and comes back, check if the
  // WebView was still open. If so, show a dialog letting them retry or cancel.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // App came back to foreground while WebView was showing
      if (
        prevState === "background" &&
        nextState === "active" &&
        paymentUrl !== null &&
        !paymentHandledRef.current
      ) {
        Alert.alert(
          "Payment In Progress",
          "It looks like you left during checkout. Your payment may or may not have gone through.\n\nTap 'Check Status' if you completed payment, or 'Cancel' to start over.",
          [
            {
              text: "Cancel Payment",
              style: "destructive",
              onPress: () => {
                setPaymentUrl(null);
                setActiveReference(null);
                setActiveOrderId(null);
                paymentHandledRef.current = false;
              },
            },
            {
              text: "Check Status",
              onPress: () => manualVerifyRef.current(),
            },
          ],
        );
      }
    });

    return () => subscription.remove();
  }, [paymentUrl]);

  // ── Manual verification (after AppState recovery) ─
  const handleVerifyManually = async () => {
    if (!activeReference) {
      Alert.alert("No Reference", "We couldn't find a payment reference to check. Please try paying again.");
      setPaymentUrl(null);
      return;
    }
    setPaymentUrl(null);
    setIsProcessingPayment(true);
    try {
      const verifyRes = await apiRequest<{ reference: string; status: string }>(
        "/api/orders/verify-payment",
        { method: "POST", auth: true, body: { reference: activeReference } },
      );
      if (verifyRes.success && verifyRes.data?.status === "paid") {
        paymentHandledRef.current = true;
        await clearDraft();
        router.replace({ pathname: "/pickup-map", params: { orderId: activeOrderId || activeReference } });
      } else {
        Alert.alert(
          "Payment Not Confirmed",
          "We could not confirm your payment was successful. Please try again or contact support if your account was debited.",
          [{ text: "OK" }],
        );
      }
    } catch {
      Alert.alert(
        "Verification Failed",
        "Could not reach our servers to verify your payment. Please check your internet connection and try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };
  manualVerifyRef.current = () => {
    void handleVerifyManually();
  };

  const totalPieces = useMemo(() => {
    if (!orderDraft) return 0;
    return orderDraft.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [orderDraft]);

  const previewItems = useMemo(
    () => orderDraft?.lineItems.slice(0, 3) ?? [],
    [orderDraft],
  );

  const turnaroundHours = getTurnaroundHours(isExpress);
  const promisedDeliveryLabel = formatDateTime(
    resolvePromisedDeliveryISO(new Date().toISOString(), isExpress),
  );

  const payableAmount = orderDraft
    ? isExpress ? orderDraft.totals.expressTotal : orderDraft.totals.standardTotal
    : 0;

  // ── Pay Button ─────────────────────────────────
  const handlePayPress = () => {
    if (!orderDraft) {
      Alert.alert("Order not ready", "Please return to Price List and rebuild your order quote.");
      return;
    }
    setShowExpressModal(true);
  };

  // ── Confirm in the Express Modal ───────────────
  const handleConfirmPayment = async () => {
    if (!orderDraft) return;

    paymentHandledRef.current = false;
    await dismissCheckoutSheet();
    setIsProcessingPayment(true);

    try {
      const response = await apiRequest<{
        authorization_url: string | null;
        reference: string | null;
        orderId: string;
        payment_method: "paystack" | "pay_on_delivery";
        payment_status: "pending" | "unpaid";
      }>("/api/orders/create", {
        method: "POST",
        auth: true,
        body: {
          draft: {
            ...orderDraft,
            isExpress,
            turnaroundHours,
          },
          isExpress,
          turnaroundHours,
          paymentMethod,
        },
      });

      if (response.success && response.data?.payment_method === "pay_on_delivery") {
        await clearDraft();
        router.replace({ pathname: "/pickup-map", params: { orderId: response.data.orderId } });
        return;
      }

      if (response.success && response.data?.authorization_url && response.data.reference) {
        const { authorization_url, reference, orderId } = response.data;
        setActiveReference(reference);
        setActiveOrderId(orderId);
        setWebViewError(null);
        setPaymentUrl(authorization_url);
        return;
      }

      // Backend returned success:false — do NOT proceed without payment
      Alert.alert(
        "Could Not Start Checkout",
        response.message || "We couldn't initialize your payment session. Please try again.",
        [{ text: "OK" }],
      );
    } catch {
      // Network error or server error — do NOT create a fake order
      Alert.alert(
        "Connection Error",
        "We couldn't reach our payment server. Please check your internet connection and try again.\n\nYour order has NOT been placed.",
        [{ text: "OK" }],
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ── WebView: user taps close / hardware back ───
  const handleCancelWebViewPayment = useCallback(() => {
    Alert.alert(
      "Cancel Checkout",
      "Are you sure you want to cancel? Your payment will NOT be processed and no money will be charged.",
      [
        { text: "No, Continue", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            setPaymentUrl(null);
            setActiveReference(null);
            setActiveOrderId(null);
            paymentHandledRef.current = false;
          },
        },
      ],
    );
  }, []);

  const handleBackNavigation = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setIsLeavingCheckout(true);

    // Paint the feedback first so navigation feels responsive even while the
    // previous garment review tree is being restored.
    leaveTimerRef.current = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/new-order");
    }, ORDER_TRANSITION_COVER_MS);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (paymentUrl) handleCancelWebViewPayment();
        else handleBackNavigation();
        return true;
      },
    );

    return () => {
      subscription.remove();
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, [handleBackNavigation, handleCancelWebViewPayment, paymentUrl]);

  // ── WebView: navigation state change ──────────
  const handleWebViewNavigationStateChange = async (navState: any) => {
    const { url } = navState;
    if (!url) return;

    // Only handle terminal Paystack URLs — not intermediate navigations
    if (!isPaystackTerminalUrl(url)) return;

    // Guard against double-fire (WebView can fire this multiple times)
    if (paymentHandledRef.current) return;
    paymentHandledRef.current = true;

    setPaymentUrl(null);
    setIsProcessingPayment(true);

    try {
      if (!activeReference) {
        throw new Error("No payment reference available to verify.");
      }

      // ── Step 1: Verify payment with Paystack via backend ──
      const verifyRes = await apiRequest<{ reference: string; status: string }>(
        "/api/orders/verify-payment",
        { method: "POST", auth: true, body: { reference: activeReference } },
      );

      if (!verifyRes.success || verifyRes.data?.status !== "paid") {
        // Payment was NOT successful (e.g. user closed Paystack without paying,
        // or card was declined). Do NOT navigate to tracking.
        Alert.alert(
          "Payment Not Completed",
          "Your payment was not completed or was declined. No charge was made. You can try again.",
          [{ text: "Try Again", onPress: () => { paymentHandledRef.current = false; } }],
        );
        return;
      }

      // ── Step 2: Payment confirmed — clear draft so next visit starts fresh ──
      await clearDraft();

      // ── Step 3: Navigate to tracking ──
      router.replace({
        pathname: "/pickup-map",
        params: { orderId: activeOrderId || activeReference },
      });

    } catch {
      // Network failure during verification. We do NOT assume payment succeeded.
      paymentHandledRef.current = false;
      Alert.alert(
        "Verification Error",
        "We couldn't confirm your payment status due to a network error. Please do NOT retry payment — contact support with your reference code.\n\nReference: " +
          (activeReference || "Unknown"),
        [
          { text: "OK" },
          {
            text: "Check Again",
            onPress: () => handleVerifyManually(),
          },
        ],
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ── WebView error handler ──────────────────────
  const handleWebViewError = () => {
    setWebViewError("Failed to load payment page. Please check your internet connection.");
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <LinearGradient
      colors={[LaundryTheme.colors.bgStart, "#FFFFFF", LaundryTheme.colors.bgEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.content}>
          {/* Header */}
          <Animated.View style={[styles.headerBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerRow}>
              <SoftPressable onPress={handleBackNavigation} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color={LaundryTheme.colors.ink} />
              </SoftPressable>
              <Text style={styles.title}>Payment</Text>
              <View style={styles.secureBadge}>
                <Ionicons name="shield-checkmark" size={14} color={LaundryTheme.colors.primaryDark} />
                <Text style={styles.secureBadgeText}>Secure</Text>
              </View>
            </View>
          </Animated.View>

          {orderDraft ? (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Total Amount Hero */}
              <Animated.View style={[styles.totalHero, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <LinearGradient
                  colors={["#451075", "#6E22CB", "#8B5CF6"]}
                  style={styles.totalGradient}
                >
                  <View style={styles.heroOrbLarge} />
                  <View style={styles.heroOrbSmall} />
                  <View style={styles.heroContent}>
                    <View style={styles.heroCopy}>
                      <View style={styles.heroBadge}>
                        <Ionicons name="lock-closed" size={11} color="#F8D66D" />
                        <Text style={styles.heroBadgeText}>SECURE CHECKOUT</Text>
                      </View>
                      <Text style={styles.totalLabel}>Total to pay</Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={styles.totalAmount}
                      >
                        {formatNaira(payableAmount)}
                      </Text>
                      <Text style={styles.totalMeta}>
                        {totalPieces} pieces • {isExpress ? "Express 24h" : "Standard 72h"}
                      </Text>
                    </View>

                    <View style={styles.heroPreviewStack}>
                      {previewItems.map((item, index) => {
                        const source = getGarmentImage(item.id);
                        return (
                          <View
                            key={item.id}
                            style={[styles.heroPreviewCard, { marginLeft: index === 0 ? 0 : -13 }]}
                          >
                            {source ? (
                              <Image
                                source={source}
                                style={styles.heroPreviewImage}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                              />
                            ) : (
                              <Ionicons name="shirt-outline" size={22} color={LaundryTheme.colors.primaryDark} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Order Recap Card */}
              <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <CardHeader icon="bag-check-outline" title="Order details" />
                <RecapRow label="Service" value={MODE_OPTIONS[orderDraft.mode].label} />
                <RecapRow label="Items" value={`${totalPieces} pieces`} />
                <RecapRow
                  label="Pickup"
                  value={`${getPickupDayLabel(orderDraft.pickupDay)} • ${getPickupWindowLabel(orderDraft.pickupWindow)}`}
                />
                <RecapRow
                  label="Delivery"
                  value={`${promisedDeliveryLabel} • within ${turnaroundHours}h`}
                />
                <RecapRow label="Address" value={orderDraft.address} />
              </Animated.View>

              {/* Price Breakdown Card */}
              <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <CardHeader icon="receipt-outline" title="Price breakdown" />
                <PriceRow label="Base subtotal" amount={orderDraft.totals.baseSubtotal} />
                <PriceRow label={`${MODE_OPTIONS[orderDraft.mode].label} subtotal`} amount={orderDraft.totals.modeSubtotal} />
                <PriceRow label="Pickup & delivery" amount={orderDraft.totals.pickupDeliveryFee} />
                <View style={styles.divider} />
                <PriceRow label="Standard total" amount={orderDraft.totals.standardTotal} highlight />
                {isExpress && (
                  <>
                    <PriceRow label="Express surcharge" amount={orderDraft.totals.expressPremium} prefix="+" />
                    <PriceRow label="Express delivery" amount={orderDraft.totals.expressDeliveryFee} prefix="+" />
                    <PriceRow label="Express total" amount={orderDraft.totals.expressTotal} highlight />
                  </>
                )}
              </Animated.View>

              {/* Delivery speed context */}
              <Animated.View style={[styles.expressNudge, { opacity: fadeAnim }]}>
                <Ionicons
                  name={isExpress ? "flash" : "time-outline"}
                  size={18}
                  color={LaundryTheme.colors.primaryDark}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nudgeTitle}>
                    {isExpress ? "Express delivery selected" : "Need it sooner?"}
                  </Text>
                  <Text style={styles.nudgeBody}>
                    {isExpress
                      ? "Returned within 24 hours from the time your order is placed."
                      : `Upgrade at checkout for ${formatNaira(
                          orderDraft.totals.expressPremium +
                            orderDraft.totals.expressDeliveryFee,
                        )} more and receive it within 24 hours.`}
                  </Text>
                </View>
              </Animated.View>
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="alert-circle-outline" size={24} color={LaundryTheme.colors.warning} />
              <Text style={styles.emptyTitle}>Missing order draft</Text>
              <Text style={styles.emptyBody}>Start from Price List to generate your quote.</Text>
              <SoftPressable onPress={() => router.replace("/new-order")} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Go to Price List</Text>
              </SoftPressable>
            </View>
          )}

          {/* Pay Button */}
          <View style={{ paddingBottom: 12, paddingTop: 6 }}>
            <SoftPressable
              onPress={handlePayPress}
              style={[styles.payButton, !orderDraft && styles.payButtonDisabled]}
            >
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={styles.payText}>Pay securely</Text>
              <View style={styles.payDivider} />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.76}
                style={styles.payAmount}
              >
                {formatNaira(payableAmount)}
              </Text>
            </SoftPressable>
          </View>
        </View>

        {/* ── Processing Overlay ── */}
        {isProcessingPayment && !showExpressModal && !paymentUrl && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingCard}>
              <ActivityIndicator color={LaundryTheme.colors.primary} size="large" />
              <Text style={styles.processingTitle}>Securing your order…</Text>
              <Text style={styles.processingBody}>Please wait while we prepare your selected payment option.</Text>
            </View>
          </View>
        )}

        {/* ── Order confirmation modal ── */}
        <Modal
          animationType="none"
          transparent
          visible={showExpressModal}
          onRequestClose={() => setShowExpressModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modalCard, { transform: [{ translateY: modalSlide }] }]}>
              <SafeAreaView edges={["bottom"]} style={{ width: "100%" }}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Review checkout</Text>
                <Text style={styles.modalBody}>
                  Your step 1 choice is preselected. Review the price and upgrade if needed.
                </Text>

                {orderDraft ? (
                  <>
                    <SoftPressable
                      onPress={() => setIsExpress(false)}
                      style={[styles.optionCard, !isExpress && styles.optionCardActive]}
                    >
                      <View style={styles.optionHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionTitle}>Standard</Text>
                          <Text style={styles.optionDetail}>Returned within 72 hours (3 days)</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.72}
                            style={styles.optionAmount}
                          >
                            {formatNaira(orderDraft.totals.standardTotal)}
                          </Text>
                          {!isExpress && <Ionicons name="checkmark-circle" size={20} color={LaundryTheme.colors.primary} />}
                        </View>
                      </View>
                    </SoftPressable>

                    <SoftPressable
                      onPress={() => setIsExpress(true)}
                      style={[styles.optionCard, isExpress && styles.optionCardActive]}
                    >
                      <View style={styles.optionHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionTitle}>⚡ Express</Text>
                          <Text style={styles.optionDetail}>
                            +{formatNaira(
                              orderDraft.totals.expressPremium +
                                orderDraft.totals.expressDeliveryFee,
                            )} • returned within 24 hours
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.72}
                            style={styles.optionAmount}
                          >
                            {formatNaira(orderDraft.totals.expressTotal)}
                          </Text>
                          {isExpress && <Ionicons name="checkmark-circle" size={20} color={LaundryTheme.colors.primary} />}
                        </View>
                      </View>
                    </SoftPressable>
                  </>
                ) : null}

                <Text style={styles.paymentSectionLabel}>PAYMENT METHOD</Text>
                <View style={styles.paymentMethodRow}>
                  <SoftPressable
                    onPress={() => setPaymentMethod("paystack")}
                    style={[styles.paymentMethodCard, paymentMethod === "paystack" && styles.paymentMethodCardActive]}
                  >
                    <Ionicons name="card-outline" size={21} color={LaundryTheme.colors.primaryDark} />
                    <View style={styles.paymentMethodCopy}>
                      <Text style={styles.paymentMethodTitle}>Pay now</Text>
                      <Text style={styles.paymentMethodDetail}>Secure Paystack checkout</Text>
                    </View>
                    {paymentMethod === "paystack" ? <Ionicons name="checkmark-circle" size={20} color={LaundryTheme.colors.primary} /> : null}
                  </SoftPressable>

                  {payOnDeliveryEligible ? (
                    <SoftPressable
                      onPress={() => setPaymentMethod("pay_on_delivery")}
                      style={[styles.paymentMethodCard, paymentMethod === "pay_on_delivery" && styles.paymentMethodCardActive]}
                    >
                      <Ionicons name="hand-left-outline" size={21} color={LaundryTheme.colors.primaryDark} />
                      <View style={styles.paymentMethodCopy}>
                        <Text style={styles.paymentMethodTitle}>Pay on delivery</Text>
                        <Text style={styles.paymentMethodDetail}>Trust option for your first order</Text>
                      </View>
                      {paymentMethod === "pay_on_delivery" ? <Ionicons name="checkmark-circle" size={20} color={LaundryTheme.colors.primary} /> : null}
                    </SoftPressable>
                  ) : isLoadingPaymentOptions ? (
                    <View style={styles.paymentOptionLoading}>
                      <ActivityIndicator size="small" color={LaundryTheme.colors.primary} />
                      <Text style={styles.paymentMethodDetail}>Checking first-order option…</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.modalActionRow}>
                  <SoftPressable onPress={() => void dismissCheckoutSheet()} style={styles.modalGhostButton}>
                    <Text style={styles.modalGhostText}>Cancel</Text>
                  </SoftPressable>
                  <SoftPressable
                    onPress={handleConfirmPayment}
                    style={[styles.modalPrimaryButton, isProcessingPayment && { opacity: 0.6 }]}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        style={styles.modalPrimaryText}
                      >
                        {paymentMethod === "pay_on_delivery" ? "Confirm order" : `Pay ${formatNaira(payableAmount)}`}
                      </Text>
                    )}
                  </SoftPressable>
                </View>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>

        {/* ── Paystack In-App WebView Modal ── */}
        {paymentUrl ? (
          <Modal
            visible={!!paymentUrl}
            animationType="slide"
            onRequestClose={handleCancelWebViewPayment}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "bottom"]}>
              <View style={styles.webHeader}>
                <SoftPressable onPress={handleCancelWebViewPayment} style={styles.webCloseBtn}>
                  <Ionicons name="close" size={24} color={LaundryTheme.colors.ink} />
                </SoftPressable>
                <Text style={styles.webTitle}>Secure Payment</Text>
                <Ionicons name="lock-closed" size={18} color={LaundryTheme.colors.success} />
              </View>

              {webViewError ? (
                <View style={styles.webErrorContainer}>
                  <Ionicons name="wifi-outline" size={40} color={LaundryTheme.colors.muted} />
                  <Text style={styles.webErrorTitle}>Failed to Load</Text>
                  <Text style={styles.webErrorBody}>{webViewError}</Text>
                  <SoftPressable
                    onPress={() => { setWebViewError(null); setPaymentUrl(paymentUrl); }}
                    style={styles.webRetryButton}
                  >
                    <Text style={styles.webRetryText}>Retry</Text>
                  </SoftPressable>
                  <SoftPressable
                    onPress={() => { setPaymentUrl(null); setWebViewError(null); paymentHandledRef.current = false; }}
                    style={styles.webCancelButton}
                  >
                    <Text style={styles.webCancelText}>Cancel Payment</Text>
                  </SoftPressable>
                </View>
              ) : (
                <WebView
                  source={{ uri: paymentUrl }}
                  onNavigationStateChange={handleWebViewNavigationStateChange}
                  onError={handleWebViewError}
                  startInLoadingState
                  renderLoading={() => (
                    <ActivityIndicator
                      color={LaundryTheme.colors.primary}
                      size="large"
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                />
              )}
            </SafeAreaView>
          </Modal>
        ) : null}

        <OrderTransitionOverlay
          visible={isLeavingCheckout}
          label="Returning to your order review…"
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function CardHeader({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderIcon}>
        <Ionicons name={icon} size={17} color={LaundryTheme.colors.primaryDark} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function PriceRow({
  label,
  amount,
  prefix = "",
  highlight = false,
}: {
  label: string;
  amount: number;
  prefix?: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, highlight && styles.priceHighlight]}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={[styles.priceValue, highlight && styles.priceHighlight]}
      >
        {prefix}{formatNaira(amount)}
      </Text>
    </View>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  scrollContent: { paddingBottom: 22 },

  // Header
  headerBlock: { marginBottom: 6 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff",
    ...LaundryTheme.shadow.soft,
  },
  title: { fontSize: 22, fontWeight: "900", color: LaundryTheme.colors.ink, paddingVertical: 4, paddingHorizontal: 2 },
  secureBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  secureBadgeText: { fontSize: 11, fontWeight: "800", color: LaundryTheme.colors.primaryDark },

  // Total Hero
  totalHero: { marginTop: 10, marginBottom: 15 },
  totalGradient: {
    minHeight: 168,
    borderRadius: 26,
    padding: 18,
    overflow: "hidden",
    ...LaundryTheme.shadow.strong,
  },
  heroOrbLarge: {
    position: "absolute", width: 150, height: 150, borderRadius: 75,
    right: -42, top: -58, backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroOrbSmall: {
    position: "absolute", width: 92, height: 92, borderRadius: 46,
    right: 46, bottom: -48, backgroundColor: "rgba(255,255,255,0.07)",
  },
  heroContent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroBadge: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.12)", marginBottom: 14,
  },
  heroBadgeText: { color: "#F8D66D", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 },
  totalLabel: { color: "rgba(255,255,255,0.76)", fontSize: 12, fontWeight: "700" },
  totalAmount: {
    color: "#fff", fontSize: 34, fontWeight: "900", marginTop: 2,
    letterSpacing: -1, lineHeight: 42, paddingVertical: 1, width: "100%",
  },
  totalMeta: { color: "rgba(255,255,255,0.78)", fontSize: 11.5, fontWeight: "700", marginTop: 5 },
  heroPreviewStack: { width: 92, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  heroPreviewCard: {
    width: 44, height: 54, borderRadius: 14, padding: 3,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.8)",
    ...LaundryTheme.shadow.soft,
  },
  heroPreviewImage: { width: "100%", height: "100%" },

  // Cards
  card: {
    ...LaundryTheme.glass,
    borderRadius: 22, padding: 17, marginBottom: 13,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 },
  cardHeaderIcon: {
    width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: LaundryTheme.colors.ink },

  // Recap rows
  recapRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, alignItems: "center" },
  recapLabel: { fontSize: 14, color: LaundryTheme.colors.muted, fontWeight: "600", flexShrink: 0, paddingVertical: 4, paddingHorizontal: 2 },
  recapValue: { fontSize: 15, color: LaundryTheme.colors.ink, fontWeight: "700", flex: 1, marginLeft: 16, textAlign: "right" },

  // Price rows
  priceRow: { flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 10 },
  priceLabel: { flex: 1, minWidth: 0, fontSize: 13.5, color: LaundryTheme.colors.muted, fontWeight: "600", paddingVertical: 4 },
  priceValue: { width: "43%", fontSize: 14, color: LaundryTheme.colors.ink, fontWeight: "800", textAlign: "right", lineHeight: 21, paddingVertical: 2 },
  priceHighlight: { color: LaundryTheme.colors.primaryDark, fontWeight: "900", fontSize: 16.5, lineHeight: 23 },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginVertical: 10 },

  // Express nudge
  expressNudge: {
    // ...LaundryTheme.glass,
    borderRadius: 16, padding: 14,
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginBottom: 14,
  },
  nudgeTitle: { fontWeight: "800", fontSize: 15, color: LaundryTheme.colors.ink },
  nudgeBody: { fontSize: 13, color: LaundryTheme.colors.muted, marginTop: 2, lineHeight: 18 },

  // Pay CTA
  payButton: {
    borderRadius: 18, paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: LaundryTheme.colors.primary,
    ...LaundryTheme.shadow.strong,
  },
  payText: { color: "#fff", fontWeight: "900", fontSize: 16, lineHeight: 22 },
  payDivider: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.32)", marginHorizontal: 2 },
  payAmount: { maxWidth: "44%", color: "#fff", fontWeight: "900", fontSize: 17, lineHeight: 23 },
  payButtonDisabled: { opacity: 0.45 },

  // Empty state
  emptyCard: {
    marginTop: 30, borderRadius: 20, padding: 20,
    ...LaundryTheme.glass, alignItems: "center", gap: 8,
  },
  emptyTitle: { fontWeight: "800", fontSize: 18, color: LaundryTheme.colors.ink },
  emptyBody: { color: LaundryTheme.colors.muted, fontSize: 15, textAlign: "center" },
  emptyButton: {
    marginTop: 10, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18,
    backgroundColor: LaundryTheme.colors.primary,
  },
  emptyButtonText: { color: "#fff", fontWeight: "800" },

  // Processing Overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  processingCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginHorizontal: 32,
    ...LaundryTheme.shadow.strong,
  },
  processingTitle: { fontSize: 18, fontWeight: "800", color: LaundryTheme.colors.ink },
  processingBody: { fontSize: 14, color: LaundryTheme.colors.muted, textAlign: "center", lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, backgroundColor: "#fff",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 21, fontWeight: "900", color: LaundryTheme.colors.ink },
  modalBody: { marginTop: 4, fontSize: 15, color: LaundryTheme.colors.muted, marginBottom: 12 },

  optionCard: {
    marginTop: 10, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "#fff",
  },
  optionCardActive: {
    borderColor: LaundryTheme.colors.primary,
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  optionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  optionTitle: { fontWeight: "800", fontSize: 17, color: LaundryTheme.colors.ink },
  optionAmount: { width: 126, textAlign: "right", fontSize: 20, fontWeight: "900", color: LaundryTheme.colors.primaryDark, marginBottom: 2 },
  optionDetail: { fontSize: 13, color: LaundryTheme.colors.muted, marginTop: 2 },

  paymentSectionLabel: {
    marginTop: 16, marginBottom: 7, fontSize: 10, fontWeight: "900",
    letterSpacing: 1.1, color: LaundryTheme.colors.muted,
  },
  paymentMethodRow: { gap: 8 },
  paymentMethodCard: {
    minHeight: 58, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: "rgba(0,0,0,0.06)", backgroundColor: "#fff",
  },
  paymentMethodCardActive: {
    borderColor: LaundryTheme.colors.primary,
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  paymentMethodCopy: { flex: 1, minWidth: 0 },
  paymentMethodTitle: { fontSize: 14, fontWeight: "900", color: LaundryTheme.colors.ink },
  paymentMethodDetail: { marginTop: 1, fontSize: 11.5, color: LaundryTheme.colors.muted },
  paymentOptionLoading: {
    minHeight: 48, borderRadius: 14, paddingHorizontal: 13,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(109,40,217,0.05)",
  },

  modalActionRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalGhostButton: {
    flex: 1, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
  },
  modalGhostText: { fontWeight: "700", fontSize: 15, color: LaundryTheme.colors.primaryDark },
  modalPrimaryButton: {
    flex: 1.5, borderRadius: 14, paddingVertical: 14,
    alignItems: "center", backgroundColor: LaundryTheme.colors.primary,
    ...LaundryTheme.shadow.soft,
  },
  modalPrimaryText: { width: "100%", textAlign: "center", color: "#fff", fontWeight: "900", fontSize: 15 },

  // Embedded WebView Modal
  webHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
    backgroundColor: "#fff",
  },
  webCloseBtn: {
    width: 36, height: 36, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
  },
  webTitle: { fontSize: 16, fontWeight: "800", color: LaundryTheme.colors.ink },

  // WebView error state
  webErrorContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 12,
  },
  webErrorTitle: { fontSize: 20, fontWeight: "800", color: LaundryTheme.colors.ink },
  webErrorBody: { fontSize: 15, color: LaundryTheme.colors.muted, textAlign: "center", lineHeight: 22 },
  webRetryButton: {
    marginTop: 8, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
    backgroundColor: LaundryTheme.colors.primary,
  },
  webRetryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  webCancelButton: {
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.1)",
  },
  webCancelText: { color: LaundryTheme.colors.muted, fontWeight: "700", fontSize: 14 },
});
