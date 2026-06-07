import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  LAUNDRY_CATALOG,
  MODE_OPTIONS,
  PICKUP_DAY_OPTIONS,
  PICKUP_WINDOW_OPTIONS,
} from "@/constants/pricing";
import { calculateTotals, formatNaira } from "@/lib/pricing";
import { createOrderFromDraft } from "@/lib/order-storage";
import {
  LaundryMode,
  OrderDraft,
  OrderLineItem,
  PickupDayCode,
  PickupWindowCode,
} from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
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
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type QuantityMap = Record<string, number>;

function createInitialQuantities(): QuantityMap {
  const entries = LAUNDRY_CATALOG.map((item) => [item.id, 0] as const);
  return Object.fromEntries(entries) as QuantityMap;
}

const modeEntries = Object.entries(MODE_OPTIONS) as [
  LaundryMode,
  (typeof MODE_OPTIONS)[LaundryMode],
][];

const regularItems = LAUNDRY_CATALOG.filter(
  (item) => item.category === "regular",
);
const extraItems = LAUNDRY_CATALOG.filter((item) => item.category === "extras");

const addressSuggestions = [
  "12 Allen Avenue, Ikeja, Lagos",
  "24 Kudirat Abiola Way, Oregun, Ikeja, Lagos",
  "45 Isaac John Street, GRA Ikeja, Lagos",
  "Marina Mall, 2/4 Marina Road, Lagos Island, Lagos",
  "Lekki Phase 1, Lekki, Lagos",
  "Adeniran Ogunsanya Street, Surulere, Lagos",
  "University of Lagos, Akoka, Yaba, Lagos",
  "34 Admiralty Way, Lekki Phase 1, Lagos",
  "50 Toyin Street, Ikeja, Lagos",
];

const isAddressValid = (addr: string) => {
  return addressSuggestions.includes(addr.trim());
};

const STEPS = [
  { id: 1, label: "Items", icon: "shirt-outline" as const },
  { id: 2, label: "Schedule", icon: "calendar-outline" as const },
  { id: 3, label: "Pay", icon: "card-outline" as const },
];

export default function NewOrderScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;

  // Step 1 state
  const [mode, setMode] = useState<LaundryMode>("wash-iron");
  const [quantities, setQuantities] = useState<QuantityMap>(
    createInitialQuantities,
  );

  // Step 2 state
  const [pickupDay, setPickupDay] = useState<PickupDayCode>("today");
  const [pickupWindow, setPickupWindow] = useState<PickupWindowCode>("morning");
  const [deliveryDay, setDeliveryDay] = useState<PickupDayCode>("tomorrow");
  const [deliveryWindow, setDeliveryWindow] = useState<PickupWindowCode>("afternoon");
  const [address, setAddress] = useState("12 Allen Avenue, Ikeja, Lagos");
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [note, setNote] = useState(
    "Please call on arrival and use the side gate.",
  );

  // Step 3 / Payment state
  const [showPayModal, setShowPayModal] = useState(false);
  const [isExpress, setIsExpress] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const lineItems = useMemo<OrderLineItem[]>(() => {
    return LAUNDRY_CATALOG.flatMap((item) => {
      const quantity = quantities[item.id] ?? 0;
      if (quantity <= 0) return [];
      return [
        {
          id: item.id,
          name: item.name,
          unitPrice: item.basePrice,
          quantity,
          category: item.category,
        },
      ];
    });
  }, [quantities]);

  const totals = useMemo(() => calculateTotals(lineItems, mode), [lineItems, mode]);

  const selectedPieces = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity, 0),
    [lineItems],
  );

  const isAddrValid = useMemo(() => isAddressValid(address), [address]);

  const payableAmount = isExpress ? totals.expressTotal : totals.standardTotal;

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const nextValue = Math.max(0, (prev[id] ?? 0) + delta);
      return { ...prev, [id]: nextValue };
    });
  };

  const animateStepTransition = (nextStep: number) => {
    const forward = nextStep > currentStep;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(stepOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(slideAnim, {
          toValue: forward ? -30 : 30,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
    ]).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(forward ? 30 : -30);
      Animated.parallel([
        Animated.timing(stepOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (lineItems.length === 0) {
        Alert.alert("No items", "Please add at least one laundry item to continue.");
        return;
      }
      animateStepTransition(2);
    } else if (currentStep === 2) {
      if (!isAddrValid) {
        Alert.alert("Invalid Address", "Please select a valid address from the suggestions list.");
        return;
      }
      animateStepTransition(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) animateStepTransition(currentStep - 1);
  };

  const handlePayPress = () => {
    setShowPayModal(true);
  };

  const handleSimulatePayment = async () => {
    const draft: OrderDraft = {
      address: address.trim(),
      note: note.trim(),
      mode,
      pickupDay,
      pickupWindow,
      deliveryDay,
      deliveryWindow,
      lineItems,
      totals,
    };

    try {
      setIsProcessing(true);
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const order = await createOrderFromDraft(draft, isExpress);
      setIsProcessing(false);
      setPaymentSuccess(true);
      // Brief success display then navigate
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowPayModal(false);
      setPaymentSuccess(false);
      router.replace({
        pathname: "/pickup-map",
        params: { orderId: order.id },
      });
    } catch {
      setIsProcessing(false);
      Alert.alert("Error", "Could not place order. Please try again.");
    }
  };

  const progressWidth = `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`;

  return (
    <LinearGradient
      colors={[LaundryTheme.colors.bgStart, "#FFFFFF", LaundryTheme.colors.bgEnd]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        {/* Step Header */}
        <View style={styles.stepHeader}>
          <View style={styles.stepHeaderTop}>
            {currentStep > 1 && (
              <SoftPressable onPress={handleBack} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={LaundryTheme.colors.primaryDark} />
              </SoftPressable>
            )}
            <View style={styles.stepTitleWrap}>
              <Text style={styles.stepKicker}>Step {currentStep} of {STEPS.length}</Text>
              <Text style={styles.stepTitle}>
                {currentStep === 1 ? "Choose your items" : currentStep === 2 ? "Schedule & Address" : "Review & Pay"}
              </Text>
            </View>
          </View>

          {/* Step indicator pills */}
          <View style={styles.pillRow}>
            {STEPS.map((step) => {
              const done = step.id < currentStep;
              const active = step.id === currentStep;
              return (
                <View key={step.id} style={styles.pillWrap}>
                  <View style={[styles.pill, done && styles.pillDone, active && styles.pillActive]}>
                    {done ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Ionicons name={step.icon} size={12} color={active ? "#fff" : LaundryTheme.colors.muted} />
                    )}
                  </View>
                  <Text style={[styles.pillLabel, (active || done) && styles.pillLabelActive]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
            {/* Connector lines */}
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth as any }]} />
          </View>
        </View>

        {/* Animated Step Content */}
        <Animated.View
          style={[
            styles.stepContent,
            { opacity: stepOpacity, transform: [{ translateX: slideAnim }] },
          ]}
        >
          {currentStep === 1 && (
            <Step1
              mode={mode}
              setMode={setMode}
              quantities={quantities}
              updateQuantity={updateQuantity}
              lineItems={lineItems}
              totals={totals}
              selectedPieces={selectedPieces}
              onNext={handleNext}
            />
          )}
          {currentStep === 2 && (
            <Step2
              pickupDay={pickupDay}
              setPickupDay={setPickupDay}
              pickupWindow={pickupWindow}
              setPickupWindow={setPickupWindow}
              deliveryDay={deliveryDay}
              setDeliveryDay={setDeliveryDay}
              deliveryWindow={deliveryWindow}
              setDeliveryWindow={setDeliveryWindow}
              address={address}
              setAddress={setAddress}
              filteredSuggestions={filteredSuggestions}
              setFilteredSuggestions={setFilteredSuggestions}
              showSuggestions={showSuggestions}
              setShowSuggestions={setShowSuggestions}
              note={note}
              setNote={setNote}
              isAddrValid={isAddrValid}
              onNext={handleNext}
            />
          )}
          {currentStep === 3 && (
            <Step3
              mode={mode}
              lineItems={lineItems}
              totals={totals}
              selectedPieces={selectedPieces}
              address={address}
              note={note}
              pickupDay={pickupDay}
              pickupWindow={pickupWindow}
              deliveryDay={deliveryDay}
              deliveryWindow={deliveryWindow}
              isExpress={isExpress}
              setIsExpress={setIsExpress}
              payableAmount={payableAmount}
              onPayPress={handlePayPress}
            />
          )}
        </Animated.View>
      </SafeAreaView>

      {/* Simulated Payment Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showPayModal}
        onRequestClose={() => !isProcessing && setShowPayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {paymentSuccess ? (
              <View style={styles.successWrap}>
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark" size={32} color="#fff" />
                </View>
                <Text style={styles.successTitle}>Payment Confirmed!</Text>
                <Text style={styles.successBody}>Your order has been placed. Rider is being assigned…</Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Confirm Payment</Text>
                <Text style={styles.modalSubtitle}>
                  {isExpress ? "Express Service · 48-hour return" : "Standard Service · 72-hour return"}
                </Text>

                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Total payable</Text>
                  <Text style={styles.amountValue}>{formatNaira(payableAmount)}</Text>
                  <Text style={styles.amountNote}>
                    {isExpress
                      ? `Includes ₦${(totals.expressPremium / 1000).toFixed(1)}k express surcharge + ₦${(totals.expressDeliveryFee / 1000).toFixed(1)}k delivery`
                      : `Includes ₦${(totals.pickupDeliveryFee / 1000).toFixed(1)}k pickup & delivery`}
                  </Text>
                </View>

                {/* Simulated payment methods */}
                <Text style={styles.methodsLabel}>Pay with</Text>
                <View style={styles.methodRow}>
                  {[
                    { icon: "card-outline" as const, label: "Card" },
                    { icon: "phone-portrait-outline" as const, label: "Transfer" },
                    { icon: "wallet-outline" as const, label: "Wallet" },
                  ].map((m) => (
                    <View key={m.label} style={styles.methodChip}>
                      <Ionicons name={m.icon} size={18} color={LaundryTheme.colors.primaryDark} />
                      <Text style={styles.methodChipText}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.simulatedBanner}>
                  <Ionicons name="flask-outline" size={14} color={LaundryTheme.colors.primaryDark} />
                  <Text style={styles.simulatedText}>Demo mode — payment is simulated</Text>
                </View>

                <View style={styles.modalActions}>
                  <SoftPressable
                    onPress={() => setShowPayModal(false)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </SoftPressable>
                  <SoftPressable
                    onPress={handleSimulatePayment}
                    style={styles.modalConfirmBtn}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalConfirmText}>Pay {formatNaira(payableAmount)}</Text>
                    )}
                  </SoftPressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────
// STEP 1 — Service Mode + Items
// ─────────────────────────────────────────────
function Step1({
  mode, setMode, quantities, updateQuantity, lineItems, totals, selectedPieces, onNext,
}: {
  mode: LaundryMode;
  setMode: (m: LaundryMode) => void;
  quantities: QuantityMap;
  updateQuantity: (id: string, delta: number) => void;
  lineItems: OrderLineItem[];
  totals: ReturnType<typeof calculateTotals>;
  selectedPieces: number;
  onNext: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionLabel}>Service Mode</Text>
      <View style={styles.modeGrid}>
        {modeEntries.map(([key, option]) => {
          const active = mode === key;
          return (
            <SoftPressable
              key={key}
              onPress={() => setMode(key)}
              style={[styles.modeCard, active && styles.modeCardActive]}
            >
              <View style={[styles.modeIcon, active && styles.modeIconActive]}>
                <Ionicons
                  name={key === "wash-iron" ? "water" : key === "ironing-only" ? "flame" : "droplet"}
                  size={20}
                  color={active ? "#fff" : LaundryTheme.colors.primaryDark}
                />
              </View>
              <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive]}>
                {option.label}
              </Text>
              <Text style={[styles.modeCardDetail, active && styles.modeCardDetailActive]}>
                {option.detail}
              </Text>
              {active && (
                <View style={styles.modeCheck}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                </View>
              )}
            </SoftPressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Main Garments</Text>
      <View style={styles.itemCard}>
        {regularItems.map((item) => (
          <ItemRow
            key={item.id}
            name={item.name}
            price={item.basePrice}
            quantity={quantities[item.id] ?? 0}
            onMinus={() => updateQuantity(item.id, -1)}
            onPlus={() => updateQuantity(item.id, 1)}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Extras & Accessories</Text>
      <View style={styles.itemCard}>
        {extraItems.map((item) => (
          <ItemRow
            key={item.id}
            name={item.name}
            price={item.basePrice}
            quantity={quantities[item.id] ?? 0}
            onMinus={() => updateQuantity(item.id, -1)}
            onPlus={() => updateQuantity(item.id, 1)}
          />
        ))}
      </View>

      {lineItems.length > 0 && (
        <View style={styles.miniSummary}>
          <View style={styles.miniSummaryRow}>
            <Text style={styles.miniSummaryLabel}>{selectedPieces} pieces · {lineItems.length} items</Text>
            <Text style={styles.miniSummaryTotal}>{formatNaira(totals.standardTotal)}</Text>
          </View>
          <Text style={styles.miniSummaryHint}>
            {MODE_OPTIONS[mode].label} · incl. pickup & delivery
          </Text>
        </View>
      )}

      <SoftPressable
        onPress={onNext}
        style={[styles.ctaButton, lineItems.length === 0 && styles.ctaDisabled]}
      >
        <Text style={styles.ctaText}>Next: Schedule & Address</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </SoftPressable>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STEP 2 — Schedule + Address + Notes
// ─────────────────────────────────────────────
function Step2({
  pickupDay, setPickupDay,
  pickupWindow, setPickupWindow,
  deliveryDay, setDeliveryDay,
  deliveryWindow, setDeliveryWindow,
  address, setAddress,
  filteredSuggestions, setFilteredSuggestions,
  showSuggestions, setShowSuggestions,
  note, setNote,
  isAddrValid,
  onNext,
}: {
  pickupDay: PickupDayCode; setPickupDay: (v: PickupDayCode) => void;
  pickupWindow: PickupWindowCode; setPickupWindow: (v: PickupWindowCode) => void;
  deliveryDay: PickupDayCode; setDeliveryDay: (v: PickupDayCode) => void;
  deliveryWindow: PickupWindowCode; setDeliveryWindow: (v: PickupWindowCode) => void;
  address: string; setAddress: (v: string) => void;
  filteredSuggestions: string[]; setFilteredSuggestions: (v: string[]) => void;
  showSuggestions: boolean; setShowSuggestions: (v: boolean) => void;
  note: string; setNote: (v: string) => void;
  isAddrValid: boolean;
  onNext: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Pickup Schedule */}
      <Text style={styles.sectionLabel}>Pickup Schedule</Text>
      <View style={styles.scheduleCard}>
        <Text style={styles.fieldLabel}>Pickup day</Text>
        <View style={styles.chipRow}>
          {PICKUP_DAY_OPTIONS.map((day) => {
            const active = pickupDay === day.code;
            return (
              <SoftPressable
                key={day.code}
                onPress={() => setPickupDay(day.code)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{day.label}</Text>
              </SoftPressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Pickup window</Text>
        <View style={styles.chipRow}>
          {PICKUP_WINDOW_OPTIONS.filter((w) => w.code !== "asap").map((window) => {
            const active = pickupWindow === window.code;
            return (
              <SoftPressable
                key={window.code}
                onPress={() => setPickupWindow(window.code)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{window.label}</Text>
              </SoftPressable>
            );
          })}
        </View>
      </View>

      {/* Delivery Schedule */}
      <Text style={styles.sectionLabel}>Delivery Schedule</Text>
      <View style={styles.scheduleCard}>
        <Text style={styles.fieldLabel}>Delivery day</Text>
        <View style={styles.chipRow}>
          {PICKUP_DAY_OPTIONS.map((day) => {
            const active = deliveryDay === day.code;
            return (
              <SoftPressable
                key={day.code}
                onPress={() => setDeliveryDay(day.code)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{day.label}</Text>
              </SoftPressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Delivery window</Text>
        <View style={styles.chipRow}>
          {PICKUP_WINDOW_OPTIONS.filter((w) => w.code !== "asap").map((window) => {
            const active = deliveryWindow === window.code;
            return (
              <SoftPressable
                key={window.code}
                onPress={() => setDeliveryWindow(window.code)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{window.label}</Text>
              </SoftPressable>
            );
          })}
        </View>
      </View>

      {/* Address */}
      <Text style={styles.sectionLabel}>Pickup Address</Text>
      <View style={[styles.fieldCard, { zIndex: 20 }]}>
        <View style={styles.addressInputRow}>
          <Ionicons name="location-outline" size={18} color={LaundryTheme.colors.primary} />
          <TextInput
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              if (text.trim() === "") {
                setFilteredSuggestions([]);
                setShowSuggestions(false);
              } else {
                const filtered = addressSuggestions.filter((s) =>
                  s.toLowerCase().includes(text.toLowerCase()),
                );
                setFilteredSuggestions(filtered);
                setShowSuggestions(true);
              }
            }}
            onFocus={() => {
              const filtered = addressSuggestions.filter((s) =>
                s.toLowerCase().includes(address.toLowerCase()),
              );
              setFilteredSuggestions(filtered);
              setShowSuggestions(true);
            }}
            style={styles.addressInput}
            placeholder="Search or type address…"
            placeholderTextColor="#9A8BB8"
          />
          {isAddrValid && (
            <Ionicons name="checkmark-circle" size={18} color={LaundryTheme.colors.success} />
          )}
        </View>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            {filteredSuggestions.map((item, index) => (
              <SoftPressable
                key={index}
                onPress={() => {
                  setAddress(item);
                  setShowSuggestions(false);
                }}
                style={styles.suggestionItem}
              >
                <Ionicons name="location" size={13} color={LaundryTheme.colors.primary} />
                <Text style={styles.suggestionText}>{item}</Text>
              </SoftPressable>
            ))}
          </View>
        )}
      </View>

      {/* Notes */}
      <Text style={styles.sectionLabel}>Rider Notes</Text>
      <View style={styles.fieldCard}>
        <TextInput
          value={note}
          onChangeText={setNote}
          style={[styles.addressInput, { minHeight: 72, textAlignVertical: "top" }]}
          multiline
          numberOfLines={3}
          placeholder="Gate code, fragile items, access hints…"
          placeholderTextColor="#9A8BB8"
        />
      </View>

      <SoftPressable
        onPress={onNext}
        style={[styles.ctaButton, !isAddrValid && styles.ctaDisabled]}
      >
        <Text style={styles.ctaText}>Next: Review & Pay</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </SoftPressable>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STEP 3 — Review + Pay
// ─────────────────────────────────────────────
function Step3({
  mode, lineItems, totals, selectedPieces,
  address, note, pickupDay, pickupWindow,
  deliveryDay, deliveryWindow,
  isExpress, setIsExpress,
  payableAmount, onPayPress,
}: {
  mode: LaundryMode;
  lineItems: OrderLineItem[];
  totals: ReturnType<typeof calculateTotals>;
  selectedPieces: number;
  address: string;
  note: string;
  pickupDay: PickupDayCode;
  pickupWindow: PickupWindowCode;
  deliveryDay: PickupDayCode;
  deliveryWindow: PickupWindowCode;
  isExpress: boolean;
  setIsExpress: (v: boolean) => void;
  payableAmount: number;
  onPayPress: () => void;
}) {
  const pickupDayLabel = PICKUP_DAY_OPTIONS.find((d) => d.code === pickupDay)?.label ?? pickupDay;
  const pickupWindowLabel = PICKUP_WINDOW_OPTIONS.find((w) => w.code === pickupWindow)?.label ?? pickupWindow;
  const deliveryDayLabel = PICKUP_DAY_OPTIONS.find((d) => d.code === deliveryDay)?.label ?? deliveryDay;
  const deliveryWindowLabel = PICKUP_WINDOW_OPTIONS.find((w) => w.code === deliveryWindow)?.label ?? deliveryWindow;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Order Summary Card */}
      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <Ionicons name="receipt-outline" size={18} color={LaundryTheme.colors.primaryDark} />
          <Text style={styles.reviewCardTitle}>Order Summary</Text>
        </View>

        <ReviewRow icon="shirt-outline" label="Service" value={MODE_OPTIONS[mode].label} />
        <ReviewRow icon="cube-outline" label="Items" value={`${selectedPieces} pieces · ${lineItems.length} types`} />
        <ReviewRow icon="calendar-outline" label="Pickup" value={`${pickupDayLabel} · ${pickupWindowLabel}`} />
        <ReviewRow icon="time-outline" label="Delivery" value={`${deliveryDayLabel} · ${deliveryWindowLabel}`} />
        <ReviewRow icon="location-outline" label="Address" value={address} />
        {note ? <ReviewRow icon="chatbubble-ellipses-outline" label="Note" value={note} /> : null}
      </View>

      {/* Line items breakdown */}
      {lineItems.length > 0 && (
        <View style={styles.reviewCard}>
          <View style={styles.reviewCardHeader}>
            <Ionicons name="list-outline" size={18} color={LaundryTheme.colors.primaryDark} />
            <Text style={styles.reviewCardTitle}>Items Breakdown</Text>
          </View>
          {lineItems.map((item) => (
            <View key={item.id} style={styles.lineItemRow}>
              <Text style={styles.lineItemName}>{item.name}</Text>
              <Text style={styles.lineItemQty}>×{item.quantity}</Text>
              <Text style={styles.lineItemPrice}>{formatNaira(item.unitPrice * item.quantity)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Speed selection */}
      <Text style={styles.sectionLabel}>Delivery Speed</Text>
      <View style={styles.speedRow}>
        <SoftPressable
          onPress={() => setIsExpress(false)}
          style={[styles.speedCard, !isExpress && styles.speedCardActive]}
        >
          <Ionicons
            name="time-outline"
            size={22}
            color={!isExpress ? LaundryTheme.colors.primaryDark : LaundryTheme.colors.muted}
          />
          <Text style={[styles.speedLabel, !isExpress && styles.speedLabelActive]}>Standard</Text>
          <Text style={[styles.speedAmount, !isExpress && styles.speedAmountActive]}>
            {formatNaira(totals.standardTotal)}
          </Text>
          <Text style={styles.speedDetail}>72-hour return</Text>
        </SoftPressable>

        <SoftPressable
          onPress={() => setIsExpress(true)}
          style={[styles.speedCard, isExpress && styles.speedCardActive]}
        >
          <Ionicons
            name="flash"
            size={22}
            color={isExpress ? LaundryTheme.colors.primaryDark : LaundryTheme.colors.muted}
          />
          <Text style={[styles.speedLabel, isExpress && styles.speedLabelActive]}>Express</Text>
          <Text style={[styles.speedAmount, isExpress && styles.speedAmountActive]}>
            {formatNaira(totals.expressTotal)}
          </Text>
          <Text style={styles.speedDetail}>48-hour return</Text>
        </SoftPressable>
      </View>

      {/* Price totals */}
      <View style={styles.totalsCard}>
        <PriceRow label="Subtotal" value={formatNaira(totals.modeSubtotal)} />
        <PriceRow label="Pickup & Delivery" value={formatNaira(totals.pickupDeliveryFee)} />
        {isExpress && <PriceRow label="Express surcharge" value={formatNaira(totals.expressPremium)} />}
        {isExpress && <PriceRow label="Express delivery" value={formatNaira(totals.expressDeliveryFee)} />}
        <View style={styles.totalsDivider} />
        <PriceRow label="Total" value={formatNaira(payableAmount)} highlight />
      </View>

      <SoftPressable onPress={onPayPress} style={styles.payButton}>
        <Ionicons name="lock-closed" size={16} color="#fff" />
        <Text style={styles.payButtonText}>Pay {formatNaira(payableAmount)} Securely</Text>
      </SoftPressable>

      <View style={styles.securityRow}>
        <Ionicons name="shield-checkmark" size={14} color={LaundryTheme.colors.muted} />
        <Text style={styles.securityText}>Demo mode · No real charge</Text>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────
function ReviewRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewRowIcon}>
        <Ionicons name={icon} size={14} color={LaundryTheme.colors.primaryDark} />
      </View>
      <View style={styles.reviewRowContent}>
        <Text style={styles.reviewRowLabel}>{label}</Text>
        <Text style={styles.reviewRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function PriceRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceRowLabel, highlight && styles.priceRowLabelHighlight]}>{label}</Text>
      <Text style={[styles.priceRowValue, highlight && styles.priceRowValueHighlight]}>{value}</Text>
    </View>
  );
}

function ItemRow({
  name, price, quantity, onMinus, onPlus,
}: {
  name: string; price: number; quantity: number; onMinus: () => void; onPlus: () => void;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemCopy}>
        <Text style={styles.itemName}>{name}</Text>
        <Text style={styles.itemRate}>{formatNaira(price)} / pc</Text>
      </View>
      <View style={styles.counterWrap}>
        <SoftPressable
          onPress={onMinus}
          style={[styles.counterBtn, quantity === 0 && styles.counterBtnMuted]}
        >
          <Ionicons name="remove" size={15} color={LaundryTheme.colors.ink} />
        </SoftPressable>
        <Text style={[styles.counterVal, quantity > 0 && styles.counterValActive]}>
          {quantity}
        </Text>
        <SoftPressable onPress={onPlus} style={styles.counterBtn}>
          <Ionicons name="add" size={15} color={LaundryTheme.colors.ink} />
        </SoftPressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // Step header
  stepHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: LaundryTheme.colors.border,
  },
  stepHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitleWrap: { flex: 1 },
  stepKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: LaundryTheme.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.3,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 12,
  },
  pillWrap: { alignItems: "center", gap: 4 },
  pill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFE8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pillDone: { backgroundColor: LaundryTheme.colors.primary },
  pillActive: { backgroundColor: LaundryTheme.colors.primaryDark },
  pillLabel: { fontSize: 10, fontWeight: "700", color: LaundryTheme.colors.muted },
  pillLabelActive: { color: LaundryTheme.colors.primaryDark },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: LaundryTheme.colors.primarySoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 999,
  },

  stepContent: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 24,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    marginBottom: 10,
    marginTop: 6,
  },

  // Mode cards
  modeGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  modeCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
    padding: 14,
    alignItems: "center",
    gap: 6,
    position: "relative",
    ...LaundryTheme.shadow.soft,
  },
  modeCardActive: {
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderColor: LaundryTheme.colors.primary,
  },
  modeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modeIconActive: { backgroundColor: LaundryTheme.colors.primary },
  modeCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    textAlign: "center",
  },
  modeCardTitleActive: { color: LaundryTheme.colors.primaryDark },
  modeCardDetail: { fontSize: 10, color: LaundryTheme.colors.muted, textAlign: "center" },
  modeCardDetailActive: { color: LaundryTheme.colors.primaryDark },
  modeCheck: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // Item list
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 20,
    ...LaundryTheme.shadow.soft,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#F4EDFF",
  },
  itemCopy: { flex: 1 },
  itemName: { color: LaundryTheme.colors.ink, fontWeight: "700", fontSize: 14 },
  itemRate: { marginTop: 2, color: LaundryTheme.colors.muted, fontSize: 12 },
  counterWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  counterBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  counterBtnMuted: { opacity: 0.4 },
  counterVal: {
    minWidth: 20,
    textAlign: "center",
    color: LaundryTheme.colors.muted,
    fontWeight: "800",
    fontSize: 14,
  },
  counterValActive: { color: LaundryTheme.colors.primaryDark },

  // Mini summary
  miniSummary: {
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    ...LaundryTheme.shadow.strong,
  },
  miniSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  miniSummaryLabel: { color: "#E8DBFF", fontWeight: "700", fontSize: 13 },
  miniSummaryTotal: { color: "#fff", fontWeight: "900", fontSize: 20 },
  miniSummaryHint: { color: "#C4AEFF", fontSize: 12, marginTop: 4 },

  // Schedule card
  scheduleCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 14,
    marginBottom: 20,
    ...LaundryTheme.shadow.soft,
  },
  fieldLabel: { color: LaundryTheme.colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: LaundryTheme.colors.primary, backgroundColor: LaundryTheme.colors.primary },
  chipText: { color: LaundryTheme.colors.muted, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#fff" },

  // Address field
  fieldCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 14,
    marginBottom: 20,
    ...LaundryTheme.shadow.soft,
  },
  addressInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addressInput: {
    flex: 1,
    color: LaundryTheme.colors.ink,
    fontSize: 14,
    paddingVertical: 4,
  },
  suggestionsList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0E8FF",
    paddingTop: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FAF7FF",
  },
  suggestionText: { color: LaundryTheme.colors.ink, fontSize: 13, flex: 1 },

  // Review card (step 3)
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 16,
    marginBottom: 16,
    ...LaundryTheme.shadow.soft,
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  reviewCardTitle: { fontWeight: "800", fontSize: 15, color: LaundryTheme.colors.ink },
  reviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  reviewRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  reviewRowContent: { flex: 1 },
  reviewRowLabel: { fontSize: 11, color: LaundryTheme.colors.muted, fontWeight: "700" },
  reviewRowValue: { fontSize: 14, color: LaundryTheme.colors.ink, fontWeight: "600", marginTop: 2 },

  // Line items
  lineItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F4EDFF",
  },
  lineItemName: { flex: 1, color: LaundryTheme.colors.ink, fontSize: 13, fontWeight: "600" },
  lineItemQty: { color: LaundryTheme.colors.muted, fontSize: 13, marginRight: 12 },
  lineItemPrice: { color: LaundryTheme.colors.primaryDark, fontWeight: "800", fontSize: 13 },

  // Speed selection
  speedRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  speedCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
    padding: 16,
    alignItems: "center",
    gap: 4,
    ...LaundryTheme.shadow.soft,
  },
  speedCardActive: {
    borderColor: LaundryTheme.colors.primary,
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  speedLabel: { fontWeight: "800", fontSize: 14, color: LaundryTheme.colors.muted },
  speedLabelActive: { color: LaundryTheme.colors.primaryDark },
  speedAmount: { fontWeight: "900", fontSize: 18, color: LaundryTheme.colors.muted },
  speedAmountActive: { color: LaundryTheme.colors.primaryDark },
  speedDetail: { fontSize: 11, color: LaundryTheme.colors.muted, marginTop: 2 },

  // Totals card
  totalsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 16,
    marginBottom: 20,
    ...LaundryTheme.shadow.soft,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  priceRowLabel: { color: LaundryTheme.colors.muted, fontSize: 13 },
  priceRowValue: { color: LaundryTheme.colors.ink, fontWeight: "700", fontSize: 13 },
  priceRowLabelHighlight: { color: LaundryTheme.colors.ink, fontWeight: "800", fontSize: 15 },
  priceRowValueHighlight: { color: LaundryTheme.colors.primaryDark, fontWeight: "900", fontSize: 18 },
  totalsDivider: { height: 1, backgroundColor: "#F0E8FF", marginVertical: 8 },

  // CTA buttons
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 8,
    ...LaundryTheme.shadow.strong,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Pay button
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 8,
    ...LaundryTheme.shadow.strong,
  },
  payButtonText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  securityRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 },
  securityText: { color: LaundryTheme.colors.muted, fontSize: 12 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 36,
    ...LaundryTheme.shadow.strong,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E0D5F5",
    alignSelf: "center",
    marginBottom: 18,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: LaundryTheme.colors.ink, marginBottom: 4 },
  modalSubtitle: { color: LaundryTheme.colors.muted, fontSize: 14, marginBottom: 20 },
  amountBox: {
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
  },
  amountLabel: { color: LaundryTheme.colors.primaryDark, fontSize: 12, fontWeight: "700" },
  amountValue: { color: LaundryTheme.colors.primaryDark, fontSize: 34, fontWeight: "900", marginTop: 4 },
  amountNote: { color: LaundryTheme.colors.muted, fontSize: 12, marginTop: 4 },
  methodsLabel: { fontSize: 12, fontWeight: "700", color: LaundryTheme.colors.muted, marginBottom: 10 },
  methodRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  methodChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
    ...LaundryTheme.shadow.soft,
  },
  methodChipText: { fontSize: 12, fontWeight: "700", color: LaundryTheme.colors.ink },
  simulatedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  simulatedText: { fontSize: 12, color: LaundryTheme.colors.primaryDark, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 12 },
  modalCancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    alignItems: "center",
  },
  modalCancelText: { fontWeight: "700", color: LaundryTheme.colors.primaryDark },
  modalConfirmBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    ...LaundryTheme.shadow.strong,
  },
  modalConfirmText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  // Success state in modal
  successWrap: { alignItems: "center", paddingVertical: 24, gap: 12 },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...LaundryTheme.shadow.strong,
  },
  successTitle: { fontSize: 22, fontWeight: "900", color: LaundryTheme.colors.ink },
  successBody: { color: LaundryTheme.colors.muted, textAlign: "center", lineHeight: 22 },
});
