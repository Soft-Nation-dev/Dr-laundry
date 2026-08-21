import React, { useCallback, useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  BackHandler,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SoftPressable } from "@/components/soft-pressable";
import { AppHeader } from "@/components/app-header";
import { AppToast, type AppToastMessage } from "@/components/app-toast";
import { ORDER_TRANSITION_COVER_MS, OrderTransitionOverlay } from "@/components/order-transition-overlay";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  LAUNDRY_CATALOG,
  DEFAULT_ADDRESS_SUGGESTION,
} from "@/constants/pricing";
import { calculateTotals, formatNaira, getTurnaroundHours } from "@/lib/pricing";
import { getDraft } from "@/lib/order-draft";
import { getProfile } from "@/lib/profile-api";
import {
  AddressSuggestion,
  getLocalPickupAvailability,
  getPickupAvailability,
  PickupAvailabilityDay,
  resolvePickupAddress,
  searchPickupAddresses,
} from "@/lib/new-order-api";
import {
  LaundryMode,
  PickupDayCode,
  PickupWindowCode,
  OrderDraft,
  CatalogItem,
  OrderLineItem,
} from "@/types/order";
import { ServiceScheduleStep } from "@/components/new-order/service-schedule-step";
import { ItemSelectorStep } from "@/components/new-order/item-selector-step";
import { OrderReviewStep } from "@/components/new-order/order-review-step";
import { useFocusEffect } from "@react-navigation/native";

function createAddressSessionToken() {
  return `pickup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function NewOrderScreen() {
  const { express: expressParam, mode: modeParam } = useLocalSearchParams<{ express?: string; mode?: string }>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("");
  const transitioningRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTransition = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    transitionTimerRef.current = null;
    finishTimerRef.current = null;
    transitioningRef.current = false;
    setTransitioning(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetTransition();
      return () => {
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      };
    }, [resetTransition]),
  );

  const goToStep = useCallback((nextStep: 1 | 2 | 3) => {
    if (transitioningRef.current || nextStep === step) return;

    transitioningRef.current = true;
    setTransitionLabel(
      nextStep === 1
        ? "Restoring your pickup details…"
        : nextStep === 2
          ? "Preparing the garment catalogue…"
          : "Building your order summary…",
    );
    setTransitioning(true);

    // Switch the heavier step tree only after the uniform cover is fully
    // painted, then reveal it with a short fade instead of a visible jump.
    transitionTimerRef.current = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setStep(nextStep);
      requestAnimationFrame(() => {
        finishTimerRef.current = setTimeout(resetTransition, 120);
      });
    }, ORDER_TRANSITION_COVER_MS);
  }, [resetTransition, step]);

  const handleBackPress = () => {
    if (step > 1) {
      goToStep((step - 1) as 1 | 2 | 3);
    } else {
      router.back();
    }
  };

  useEffect(() => {
    const backAction = () => {
      if (step > 1) {
        goToStep((step - 1) as 1 | 2 | 3);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [goToStep, step]);

  const [mode, setMode] = useState<LaundryMode>((modeParam as LaundryMode) || "wash-iron");
  const [isExpress, setIsExpress] = useState(expressParam === "true");
  const [address, setAddress] = useState(DEFAULT_ADDRESS_SUGGESTION);
  const [addressPlaceId, setAddressPlaceId] = useState("");
  const [addressPoint, setAddressPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressResolving, setAddressResolving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressAttentionKey, setAddressAttentionKey] = useState(0);
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const addressSessionToken = useRef(createAddressSessionToken());
  const [pickupDay, setPickupDay] = useState<PickupDayCode>("today");
  const [pickupWindow, setPickupWindow] = useState<PickupWindowCode>("morning");
  const [pickupAvailability, setPickupAvailability] = useState<PickupAvailabilityDay[]>(
    () => getLocalPickupAvailability(),
  );
  const [deliveryDay, setDeliveryDay] = useState<PickupDayCode>("tomorrow");
  const [deliveryWindow, setDeliveryWindow] = useState<PickupWindowCode>("afternoon");

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const showToast = useCallback((title: string, message: string, tone: AppToastMessage["tone"] = "error") => {
    setToast({ id: Date.now(), title, message, tone });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  const focusAddress = useCallback(() => {
    setAddressAttentionKey((current) => current + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Load existing draft if available
  useEffect(() => {
    let active = true;
    (async () => {
      const [existing, profileResponse] = await Promise.all([getDraft(), getProfile()]);
      if (!active) return;
      if (existing) {
        // Prioritize routing parameters from Home screen if passed
        setMode((modeParam as LaundryMode) || existing.mode || "wash-iron");
        if (existing.address) setAddress(existing.address);
        if (existing.addressPlaceId) setAddressPlaceId(existing.addressPlaceId);
        if (typeof existing.latitude === "number" && typeof existing.longitude === "number") {
          setAddressPoint({ latitude: existing.latitude, longitude: existing.longitude });
        }
        if (existing.pickupDay) setPickupDay(existing.pickupDay);
        if (existing.pickupWindow) setPickupWindow(existing.pickupWindow);
        if (existing.deliveryDay) setDeliveryDay(existing.deliveryDay);
        if (existing.deliveryWindow) setDeliveryWindow(existing.deliveryWindow);

        if (expressParam !== undefined) {
          setIsExpress(expressParam === "true");
        } else if (typeof existing.isExpress === "boolean") {
          setIsExpress(existing.isExpress);
        }

        if (existing.note) setNote(existing.note);

        if (Array.isArray(existing.lineItems)) {
          const map: Record<string, number> = {};
          existing.lineItems.forEach((item: OrderLineItem) => {
            map[item.id] = item.quantity;
          });
          setQuantities(map);
        }
      }
      const initialAddress = existing?.address || profileResponse.data?.address?.trim() || "";
      const hasResolvedDraftAddress = Boolean(
        existing?.addressPlaceId &&
        typeof existing.latitude === "number" &&
        typeof existing.longitude === "number",
      );
      if (initialAddress && !hasResolvedDraftAddress) {
        setAddress(initialAddress);
        setAddressResolving(true);
        try {
          const resolved = await resolvePickupAddress({
            address: initialAddress,
            sessionToken: addressSessionToken.current,
          });
          if (!active) return;
          setAddress(resolved.address);
          setAddressPlaceId(resolved.placeId);
          setAddressPoint({ latitude: resolved.latitude, longitude: resolved.longitude });
          addressSessionToken.current = createAddressSessionToken();
        } catch {
          if (active) setAddressError("Tap the address to choose the exact pickup location.");
        } finally {
          if (active) setAddressResolving(false);
        }
      }
    })();
    return () => { active = false; };
  }, [modeParam, expressParam]);

  useEffect(() => {
    if (!suggestionsVisible || address.trim().length < 2 || addressPlaceId) {
      setAddressSuggestions([]);
      setAddressSearching(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setAddressSearching(true);
      setAddressError("");
      try {
        const suggestions = await searchPickupAddresses(
          address.trim(),
          addressSessionToken.current,
        );
        if (active) setAddressSuggestions(suggestions);
      } catch (error) {
        if (active) {
          setAddressSuggestions([]);
          setAddressError(error instanceof Error ? error.message : "Could not search addresses");
        }
      } finally {
        if (active) setAddressSearching(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, addressPlaceId, suggestionsVisible]);

  useEffect(() => {
    let active = true;
    const refreshAvailability = async () => {
      if (active) setPickupAvailability(getLocalPickupAvailability());
      try {
        const result = await getPickupAvailability();
        if (active && result.days.length) setPickupAvailability(result.days);
      } catch {
        // The local Lagos-time calculation remains visible while the server is unreachable.
      }
    };
    void refreshAvailability();
    const timer = setInterval(() => { void refreshAvailability(); }, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const availableDay = pickupAvailability.find((entry) => entry.day === pickupDay);
    if (!availableDay) {
      const next = pickupAvailability[0];
      if (next) {
        setPickupDay(next.day);
        setPickupWindow(next.windows[0]);
      }
      return;
    }
    if (pickupWindow === "asap" || !availableDay.windows.includes(pickupWindow)) {
      setPickupWindow(availableDay.windows[0]);
    }
  }, [pickupAvailability, pickupDay, pickupWindow]);

  const isAddressValid = useMemo(() => {
    return address.trim().length >= 5;
  }, [address]);

  const handleSelectAddress = async (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setSuggestionsVisible(false);
    setAddressSearching(false);
    setAddressResolving(true);
    setAddressError("");
    try {
      const resolved = await resolvePickupAddress({
        placeId: suggestion.id,
        sessionToken: addressSessionToken.current,
      });
      setAddress(resolved.address);
      setAddressPlaceId(resolved.placeId);
      setAddressPoint({ latitude: resolved.latitude, longitude: resolved.longitude });
      addressSessionToken.current = createAddressSessionToken();
    } catch (error) {
      setAddressPlaceId("");
      setAddressPoint(null);
      setAddressError(error instanceof Error ? error.message : "Could not confirm this address");
    } finally {
      setAddressResolving(false);
    }
  };

  const handleAddressChange = (value: string) => {
    setAddress(value);
    setAddressPlaceId("");
    setAddressPoint(null);
    setAddressError("");
    setSuggestionsVisible(value.trim().length >= 2);
  };

  // Quantity adjusters
  const handleIncrement = useCallback((itemId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  }, []);

  const handleDecrement = useCallback((itemId: string) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: current - 1 };
    });
  }, []);

  // Order draft construction
  const activeLineItems: OrderLineItem[] = useMemo(() => {
    return LAUNDRY_CATALOG.filter((item: CatalogItem) => (quantities[item.id] || 0) > 0).map(
      (item: CatalogItem) => ({
        id: item.id,
        name: item.name,
        unitPrice: item.basePrice,
        quantity: quantities[item.id],
        category: item.category,
      }),
    );
  }, [quantities]);

  const totals = useMemo(() => {
    return calculateTotals(activeLineItems, mode);
  }, [activeLineItems, mode]);

  const totalItemCount = useMemo(() => {
    return activeLineItems.reduce((acc: number, item: OrderLineItem) => acc + item.quantity, 0);
  }, [activeLineItems]);

  const currentDraft: OrderDraft = useMemo(() => {
    return {
      mode,
      address,
      addressPlaceId: addressPlaceId || undefined,
      latitude: addressPoint?.latitude,
      longitude: addressPoint?.longitude,
      pickupDay,
      pickupWindow,
      deliveryDay,
      deliveryWindow,
      isExpress,
      turnaroundHours: getTurnaroundHours(isExpress),
      lineItems: activeLineItems,
      totals,
      note,
    };
  }, [
    mode,
    address,
    addressPlaceId,
    addressPoint,
    pickupDay,
    pickupWindow,
    deliveryDay,
    deliveryWindow,
    isExpress,
    activeLineItems,
    totals,
    note,
  ]);

  const handleStep1Next = async () => {
    if (addressResolving || addressSearching) {
      showToast(
        "We’re checking your address",
        "Please wait a moment for the nearby location results, then choose the exact match.",
        "info",
      );
      focusAddress();
      return;
    }
    if (!address.trim()) {
      setAddressError("Enter the pickup address so your driver knows where to meet you.");
      showToast("Pickup address needed", "Start typing a street, estate, landmark, or area in Enugu.");
      focusAddress();
      return;
    }
    if (!isAddressValid) {
      setAddressError("Add a more complete street, landmark, or area.");
      showToast("Address is not complete yet", "Add a little more detail so we can locate the pickup accurately.");
      focusAddress();
      return;
    }
    let resolvedPoint = addressPoint;
    let resolvedPlaceId = addressPlaceId;
    if (!resolvedPoint || !resolvedPlaceId) {
      setAddressResolving(true);
      setAddressError("");
      try {
        const resolved = await resolvePickupAddress({
          address: address.trim(),
          sessionToken: addressSessionToken.current,
        });
        resolvedPoint = { latitude: resolved.latitude, longitude: resolved.longitude };
        resolvedPlaceId = resolved.placeId;
        setAddress(resolved.address);
        setAddressPoint(resolvedPoint);
        setAddressPlaceId(resolvedPlaceId);
        addressSessionToken.current = createAddressSessionToken();
      } catch (error) {
        resolvedPoint = null;
        resolvedPlaceId = "";
        const message = error instanceof Error ? error.message : "Could not confirm this address";
        setAddressError(message);
        showToast("Address not confirmed", `${message} Choose one of the nearby suggestions to continue.`);
      } finally {
        setAddressResolving(false);
      }
    }
    if (!resolvedPoint || !resolvedPlaceId) {
      setSuggestionsVisible(true);
      focusAddress();
      return;
    }
    goToStep(2);
  };

  const handleStep2Next = () => {
    if (activeLineItems.length === 0) {
      Alert.alert(
        "No items selected",
        "Please add at least 1 garment item to proceed.",
      );
      return;
    }
    goToStep(3);
  };

  const handleProceedToPayment = () => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setTransitionLabel("Opening secure checkout…");
    setTransitioning(true);
    const serialized = encodeURIComponent(JSON.stringify(currentDraft));
    transitionTimerRef.current = setTimeout(() => {
      router.push({
        pathname: "/payment",
        params: { draft: serialized },
      });
      // Safety fallback if navigation is rejected for any reason.
      finishTimerRef.current = setTimeout(resetTransition, 1400);
    }, ORDER_TRANSITION_COVER_MS);
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
      {/* Persistent App Header */}
      <AppHeader />

      {/* Step Sub-header */}
      <View style={styles.subHeader}>
        <SoftPressable onPress={handleBackPress} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={LaundryTheme.colors.ink} />
        </SoftPressable>
        <Text style={styles.headerTitle}>New Order</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Step {step} of 3</Text>
        </View>
      </View>

      {/* Step Progress Bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" },
          ]}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          step === 2 && {
            paddingBottom: 76 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <ServiceScheduleStep
            mode={mode}
            setMode={setMode}
            address={address}
            setAddress={handleAddressChange}
            addressValid={isAddressValid}
            suggestionsVisible={suggestionsVisible}
            setSuggestionsVisible={setSuggestionsVisible}
            addressSuggestions={addressSuggestions}
            addressSearching={addressSearching}
            addressResolving={addressResolving}
            addressError={addressError}
            addressConfirmed={Boolean(addressPlaceId && addressPoint)}
            addressAttentionKey={addressAttentionKey}
            selectAddress={handleSelectAddress}
            pickupAvailability={pickupAvailability}
            pickupDay={pickupDay}
            setPickupDay={setPickupDay}
            pickupWindow={pickupWindow}
            setPickupWindow={setPickupWindow}
            deliveryDay={deliveryDay}
            setDeliveryDay={setDeliveryDay}
            deliveryWindow={deliveryWindow}
            setDeliveryWindow={setDeliveryWindow}
            isExpress={isExpress}
            setIsExpress={setIsExpress}
            onNext={handleStep1Next}
          />
        )}

        {step === 2 && (
          <ItemSelectorStep
            quantities={quantities}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
          />
        )}

        {step === 3 && (
          <OrderReviewStep
            draft={currentDraft}
            note={note}
            setNote={setNote}
            onBack={() => goToStep(2)}
            onProceed={handleProceedToPayment}
          />
        )}
      </ScrollView>

      {/* Step 2 selection summary */}
      {step === 2 && (
        <View
          style={[
            styles.floatingBanner,
            { paddingBottom: Math.max(insets.bottom, 8) + 10 },
          ]}
        >
          <View style={styles.bannerCartIcon}>
            <Ionicons
              name="cart-outline"
              size={20}
              color={LaundryTheme.colors.primaryDark}
            />
          </View>
          <View style={styles.bannerMeta}>
            <Text numberOfLines={1} style={styles.bannerItems}>
              {totalItemCount} {totalItemCount === 1 ? "Item" : "Items"}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.86}
              style={styles.bannerPrice}
            >
              Total: {formatNaira(totals.modeSubtotal)}
            </Text>
          </View>
          <SoftPressable
            onPress={handleStep2Next}
            disabled={totalItemCount === 0}
            style={[
              styles.bannerBtn,
              totalItemCount === 0 && styles.bannerBtnDisabled,
            ]}
            accessibilityLabel="Review selected garments"
          >
            <Text style={styles.bannerBtnText}>Review Order</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </SoftPressable>
        </View>
      )}

      <OrderTransitionOverlay
        visible={transitioning}
        label={transitionLabel}
      />
      <AppToast
        toast={toast}
        topInset={insets.top + 10}
        onDismiss={dismissToast}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },

  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    ...LaundryTheme.shadow.soft,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.3,
  },
  stepBadge: {
    backgroundColor: LaundryTheme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: LaundryTheme.colors.primaryDark,
  },

  progressTrack: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginHorizontal: 16,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 999,
  },

  scrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 132,
  },

  floatingBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 72,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.primarySoft,
    ...LaundryTheme.shadow.strong,
  },
  bannerCartIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  bannerMeta: { flex: 1, minWidth: 0 },
  bannerItems: {
    color: LaundryTheme.colors.muted,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
  },
  bannerPrice: {
    color: LaundryTheme.colors.ink,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "900",
  },
  bannerBtn: {
    minHeight: 48,
    backgroundColor: LaundryTheme.colors.primaryDark,
    borderRadius: 17,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  bannerBtnDisabled: { opacity: 0.42 },
  bannerBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
