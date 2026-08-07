import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  LAUNDRY_CATALOG,
  ADDRESS_SUGGESTIONS,
  DEFAULT_ADDRESS_SUGGESTION,
} from "@/constants/pricing";
import { calculateTotals, formatNaira } from "@/lib/pricing";
import { saveDraft, getDraft, clearDraft } from "@/lib/order-draft";
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

export default function NewOrderScreen() {
  const { express: expressParam } = useLocalSearchParams<{ express?: string }>();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleBackPress = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3);
    } else {
      router.back();
    }
  };

  useEffect(() => {
    const backAction = () => {
      if (step > 1) {
        setStep((prev) => (prev - 1) as 1 | 2 | 3);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [step]);
  const [mode, setMode] = useState<LaundryMode>("wash-iron");
  const [address, setAddress] = useState(DEFAULT_ADDRESS_SUGGESTION);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [pickupDay, setPickupDay] = useState<PickupDayCode>("today");
  const [pickupWindow, setPickupWindow] = useState<PickupWindowCode>("morning");
  const [deliveryDay, setDeliveryDay] = useState<PickupDayCode>("tomorrow");
  const [deliveryWindow, setDeliveryWindow] = useState<PickupWindowCode>("afternoon");

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  // Load existing draft if available
  useEffect(() => {
    (async () => {
      const existing = await getDraft();
      if (existing) {
        setMode(existing.mode || "wash-iron");
        if (existing.address) setAddress(existing.address);
        if (existing.pickupDay) setPickupDay(existing.pickupDay);
        if (existing.pickupWindow) setPickupWindow(existing.pickupWindow);
        if (existing.deliveryDay) setDeliveryDay(existing.deliveryDay);
        if (existing.deliveryWindow) setDeliveryWindow(existing.deliveryWindow);
        if (existing.note) setNote(existing.note);

        if (Array.isArray(existing.lineItems)) {
          const map: Record<string, number> = {};
          existing.lineItems.forEach((item: OrderLineItem) => {
            map[item.id] = item.quantity;
          });
          setQuantities(map);
        }
      }
    })();
  }, []);

  // Filtered address suggestions
  const filteredSuggestions = useMemo(() => {
    if (!address.trim()) return ADDRESS_SUGGESTIONS;
    return ADDRESS_SUGGESTIONS.filter((s: string) =>
      s.toLowerCase().includes(address.toLowerCase()),
    );
  }, [address]);

  const isAddressValid = useMemo(() => {
    return ADDRESS_SUGGESTIONS.includes(address);
  }, [address]);

  const handleSelectAddress = (suggestion: string) => {
    setAddress(suggestion);
    setSuggestionsVisible(false);
  };

  // Quantity adjusters
  const handleIncrement = (itemId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  };

  const handleDecrement = (itemId: string) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: current - 1 };
    });
  };

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
      pickupDay,
      pickupWindow,
      deliveryDay,
      deliveryWindow,
      lineItems: activeLineItems,
      totals,
      note,
    };
  }, [
    mode,
    address,
    pickupDay,
    pickupWindow,
    deliveryDay,
    deliveryWindow,
    activeLineItems,
    totals,
    note,
  ]);

  const handleStep1Next = () => {
    if (!isAddressValid) {
      Alert.alert(
        "Address required",
        "Please select a valid Lagos delivery address from the suggestions.",
      );
      return;
    }
    setStep(2);
  };

  const handleStep2Next = () => {
    if (activeLineItems.length === 0) {
      Alert.alert(
        "No items selected",
        "Please add at least 1 garment item to proceed.",
      );
      return;
    }
    setStep(3);
  };

  const handleProceedToPayment = async () => {
    // Pass draft as URL param for immediate use in payment screen,
    // then clear AsyncStorage so the next visit starts fresh.
    const serialized = encodeURIComponent(JSON.stringify(currentDraft));
    router.push({
      pathname: "/payment",
      params: { draft: serialized },
    });
    // Clear persisted draft — if payment is abandoned, user will start fresh
    await clearDraft();
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
      <SafeAreaView style={styles.safeArea}>
        {/* Header Bar */}
        <View style={styles.header}>
          <SoftPressable onPress={handleBackPress} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={LaundryTheme.colors.ink} />
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
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <ServiceScheduleStep
              mode={mode}
              setMode={setMode}
              address={address}
              setAddress={setAddress}
              addressValid={isAddressValid}
              suggestionsVisible={suggestionsVisible}
              setSuggestionsVisible={setSuggestionsVisible}
              filteredSuggestions={filteredSuggestions}
              selectAddress={handleSelectAddress}
              pickupDay={pickupDay}
              setPickupDay={setPickupDay}
              pickupWindow={pickupWindow}
              setPickupWindow={setPickupWindow}
              deliveryDay={deliveryDay}
              setDeliveryDay={setDeliveryDay}
              deliveryWindow={deliveryWindow}
              setDeliveryWindow={setDeliveryWindow}
              onNext={handleStep1Next}
            />
          )}

          {step === 2 && (
            <ItemSelectorStep
              quantities={quantities}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onBack={() => setStep(1)}
              onNext={handleStep2Next}
            />
          )}

          {step === 3 && (
            <OrderReviewStep
              draft={currentDraft}
              note={note}
              setNote={setNote}
              onBack={() => setStep(2)}
              onProceed={handleProceedToPayment}
            />
          )}
        </ScrollView>

        {/* Floating Mini Summary Banner */}
        {totalItemCount > 0 && step !== 3 && (
          <View style={styles.floatingBanner}>
            <View style={styles.bannerMeta}>
              <Text style={styles.bannerItems}>
                {totalItemCount} {totalItemCount === 1 ? "piece" : "pieces"} selected
              </Text>
              <Text style={styles.bannerPrice}>
                {formatNaira(totals.standardTotal)}
              </Text>
            </View>
            <SoftPressable
              onPress={() => setStep(3)}
              style={styles.bannerBtn}
            >
              <Text style={styles.bannerBtnText}>Review Quote</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </SoftPressable>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    paddingVertical: 4,
    paddingHorizontal: 2,
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
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 100,
    // marginBottom: LaundryTheme.layout.bottomMenuSpace + 1000,
  },

  floatingBanner: {
    position: "absolute",
    bottom: LaundryTheme.layout.bottomMenuSpace + 5,
    left: 16,
    right: 16,
    backgroundColor: LaundryTheme.colors.ink,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...LaundryTheme.shadow.strong,
  },
  bannerMeta: { flex: 1 },
  bannerItems: { color: "#E0D0FF", fontSize: 12, fontWeight: "700" },
  bannerPrice: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 2, lineHeight: 22, paddingVertical: 2 },
  bannerBtn: {
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bannerBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
