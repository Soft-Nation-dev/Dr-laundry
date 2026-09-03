import React, { useRef } from "react";
import { ActivityIndicator, View, Text, StyleSheet, TextInput, ScrollView, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  PICKUP_DAY_OPTIONS,
  PICKUP_WINDOW_OPTIONS,
} from "@/constants/pricing";
import { formatDateTime, resolvePromisedDeliveryISO } from "@/lib/pricing";
import { LaundryMode, PickupDayCode, PickupWindowCode } from "@/types/order";
import type { AddressSuggestion, PickupAvailabilityDay } from "@/lib/new-order-api";

type Props = {
  mode: LaundryMode;
  setMode: (mode: LaundryMode) => void;
  address: string;
  setAddress: (addr: string) => void;
  addressValid: boolean;
  suggestionsVisible: boolean;
  setSuggestionsVisible: (visible: boolean) => void;
  addressSuggestions: AddressSuggestion[];
  addressSearching: boolean;
  addressResolving: boolean;
  addressError: string;
  addressConfirmed: boolean;
  addressAttentionKey: number;
  selectAddress: (suggestion: AddressSuggestion) => Promise<void>;
  pickupAvailability: PickupAvailabilityDay[];
  pickupDay: PickupDayCode;
  setPickupDay: (day: PickupDayCode) => void;
  pickupWindow: PickupWindowCode;
  setPickupWindow: (win: PickupWindowCode) => void;
  deliveryDay: PickupDayCode;
  setDeliveryDay: (day: PickupDayCode) => void;
  deliveryWindow: PickupWindowCode;
  setDeliveryWindow: (win: PickupWindowCode) => void;
  isExpress: boolean;
  setIsExpress: (val: boolean) => void;
  onNext: () => void;
};

function getEstimatedDeliveryText(
  isExpress: boolean,
): string {
  return formatDateTime(
    resolvePromisedDeliveryISO(new Date().toISOString(), isExpress),
  );
}

const modeOptions: {
  key: LaundryMode;
  label: string;
  image: any;
}[] = [
  {
    key: "wash-iron",
    label: "Washing +\nIroning",
    image: require("@/assets/images/wash_and_fold.png"),
  },
  {
    key: "ironing-only",
    label: "Ironing\nOnly",
    image: require("@/assets/images/ironing.png"),
  },
  {
    key: "washing-only",
    label: "Washing\nOnly",
    image: require("@/assets/images/dry_clean.png"),
  },
];

export function ServiceScheduleStep({
  mode,
  setMode,
  address,
  setAddress,
  addressValid: _addressValid,
  suggestionsVisible,
  setSuggestionsVisible,
  addressSuggestions,
  addressSearching,
  addressResolving,
  addressError,
  addressConfirmed,
  addressAttentionKey,
  selectAddress,
  pickupAvailability,
  pickupDay,
  setPickupDay,
  pickupWindow,
  setPickupWindow,
  deliveryDay: _deliveryDay,
  setDeliveryDay: _setDeliveryDay,
  deliveryWindow: _deliveryWindow,
  setDeliveryWindow: _setDeliveryWindow,
  isExpress,
  setIsExpress,
  onNext,
}: Props) {
  const inputRef = useRef<TextInput>(null);

  const standardEstimate = getEstimatedDeliveryText(false);
  const expressEstimate = getEstimatedDeliveryText(true);

  // Close suggestions when keyboard hides
  React.useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setSuggestionsVisible(false);
      }
    );
    return () => {
      keyboardDidHideListener.remove();
    };
  }, [setSuggestionsVisible]);

  React.useEffect(() => {
    if (addressAttentionKey <= 0) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      setSuggestionsVisible(address.trim().length >= 2);
    });
  }, [address, addressAttentionKey, setSuggestionsVisible]);

  const handleAddressSelect = async (suggestion: AddressSuggestion) => {
    // Commit the value before dismissing the keyboard. On Android the outer
    // ScrollView can otherwise close the suggestion list before the press ends.
    await selectAddress(suggestion);
    setSuggestionsVisible(false);
    Keyboard.dismiss();
  };

  const availableDayCodes = new Set(pickupAvailability.map((entry) => entry.day));
  const availableWindows = pickupAvailability.find((entry) => entry.day === pickupDay)?.windows ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.mainHeading}>Schedule Pickup</Text>

      <View style={styles.cardContainer}>
        {/* ── 1. SERVICE TYPE ── */}
        <Text style={styles.sectionLabel}>SERVICE TYPE</Text>
        <View style={styles.segmentedControl}>
          {modeOptions.map((item, index) => {
            const active = mode === item.key;
            return (
              <React.Fragment key={item.key}>
                {index > 0 && <View style={styles.segmentDivider} />}
                <SoftPressable
                  onPress={() => setMode(item.key)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <View style={[styles.illustrationMiniWrap, active && styles.illustrationMiniWrapActive]}>
                    <Image
                      source={item.image}
                      style={styles.illustrationMini}
                      contentFit="contain"
                    />
                  </View>
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {item.label}
                  </Text>
                </SoftPressable>
              </React.Fragment>
            );
          })}
        </View>

        {/* ── 2. PICKUP ADDRESS ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>PICKUP ADDRESS</Text>
          {addressConfirmed ? <Text style={styles.confirmedLabel}>Location confirmed</Text> : null}
        </View>

        <View style={{ zIndex: 50, position: "relative" }}>
          <View style={[
            styles.addressInputCard,
            addressConfirmed && styles.addressInputConfirmed,
            addressError && !addressConfirmed && styles.addressInputError,
          ]}>
            <Ionicons name={addressConfirmed ? "location" : "search-outline"} size={18} color={LaundryTheme.colors.primaryDark} />
            <TextInput
              ref={inputRef}
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              onFocus={() => setSuggestionsVisible(address.trim().length >= 2)}
              placeholder="Start typing your pickup address..."
              placeholderTextColor={LaundryTheme.colors.muted}
              autoCorrect={false}
              returnKeyType="search"
            />
            {addressSearching || addressResolving ? (
              <ActivityIndicator size="small" color={LaundryTheme.colors.primary} />
            ) : addressConfirmed ? (
              <Ionicons name="checkmark-circle" size={22} color={LaundryTheme.colors.success} />
            ) : null}
          </View>

          {suggestionsVisible && !addressConfirmed && address.trim().length >= 2 && (
            <View style={styles.suggestionsList}>
              <ScrollView
                style={{ maxHeight: 180 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
              >
                {addressSearching ? (
                  <View style={styles.suggestionLoading}>
                    <ActivityIndicator size="small" color={LaundryTheme.colors.primary} />
                    <Text style={[styles.addressEmpty, styles.loadingText]}>Finding nearby addresses…</Text>
                  </View>
                ) : addressSuggestions.length ? (
                  addressSuggestions.map((suggestion) => (
                    <SoftPressable
                      key={suggestion.id}
                      onPress={() => { void handleAddressSelect(suggestion); }}
                      style={styles.suggestionItem}
                    >
                      <Ionicons name="pin-outline" size={15} color={LaundryTheme.colors.primaryDark} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionText}>{suggestion.mainText}</Text>
                        <Text style={styles.suggestionSecondary} numberOfLines={1}>{suggestion.secondaryText}</Text>
                      </View>
                    </SoftPressable>
                  ))
                ) : !addressError ? (
                  <Text style={styles.addressEmpty}>No nearby match yet. Add a street, landmark, or area.</Text>
                ) : null}
                <Text style={styles.googleAttribution}>Powered by Google</Text>
              </ScrollView>
            </View>
          )}
        </View>
        {addressError ? <Text style={styles.addressError}>{addressError}</Text> : null}

        {/* ── 3. PICKUP TIME ── */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PICKUP TIME</Text>

        <View style={styles.subHeaderRow}>
          <Text style={styles.subHeaderLabel}>Day</Text>
          <Ionicons name="calendar-outline" size={16} color={LaundryTheme.colors.primaryDark} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          {PICKUP_DAY_OPTIONS.filter((day) => availableDayCodes.has(day.code)).map((day) => {
            const active = pickupDay === day.code;
            return (
              <SoftPressable
                key={day.code}
                onPress={() => setPickupDay(day.code)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {day.label}
                </Text>
              </SoftPressable>
            );
          })}
        </ScrollView>

        <View style={[styles.subHeaderRow, { marginTop: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.subHeaderLabel}>Time</Text>
            <Ionicons name="time-outline" size={15} color={LaundryTheme.colors.primaryDark} />
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          {PICKUP_WINDOW_OPTIONS.filter(
            (window) => window.code !== "asap" && availableWindows.includes(window.code),
          ).map((window) => {
            const active = pickupWindow === window.code;
            return (
              <SoftPressable
                key={window.code}
                onPress={() => setPickupWindow(window.code)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {window.label}
                </Text>
              </SoftPressable>
            );
          })}
        </ScrollView>

        {/* ── 4. DELIVERY — selectable ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
          <Text style={styles.sectionLabel}>DELIVERY</Text>
          <Ionicons name="settings-outline" size={15} color={LaundryTheme.colors.muted} />
        </View>

        {/* Standard 72h — selectable */}
        <SoftPressable
          onPress={() => setIsExpress(false)}
          style={[styles.deliveryCard, !isExpress && styles.deliveryCardSelected]}
        >
          <View style={styles.deliveryRow}>
            <Text style={styles.deliveryIcon}>🚚</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.deliveryTitle}>Standard 72h Turnaround</Text>
              <Text style={styles.deliverySubtext}>Estimated: {standardEstimate}</Text>
            </View>
            <View style={[styles.radioOuter, !isExpress && styles.radioOuterActive]}>
              {!isExpress && <View style={styles.radioInner} />}
            </View>
          </View>
        </SoftPressable>

        {/* Express 24h — selectable */}
        <SoftPressable
          onPress={() => setIsExpress(true)}
          style={[styles.deliveryCard, styles.expressCard, isExpress && styles.deliveryCardSelected]}
        >
          <View style={styles.deliveryRow}>
            <Text style={styles.deliveryIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.deliveryTitle, { color: LaundryTheme.colors.primary }]}>
                Express 24h Turnaround
              </Text>
              <Text style={styles.deliverySubtext}>
                Estimated: {expressEstimate} · +50% of order
              </Text>
            </View>
            <View style={[styles.radioOuter, isExpress && styles.radioOuterActive]}>
              {isExpress && <View style={styles.radioInner} />}
            </View>
          </View>
        </SoftPressable>

        {/* ── Continue CTA ── */}
        <SoftPressable onPress={onNext} style={styles.continueBtn}>
          {addressResolving ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
          <Text style={styles.continueBtnText}>
            {addressResolving ? "Confirming pickup address…" : "Continue to Select Items"}
          </Text>
          {!addressResolving ? <Ionicons name="arrow-forward" size={18} color="#FFFFFF" /> : null}
        </SoftPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  mainHeading: {
    fontSize: 24,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(230, 220, 250, 0.6)",
    ...(LaundryTheme.shadow.soft as any),
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  // Segmented Control
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "rgba(244, 238, 252, 0.7)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(230, 220, 250, 0.8)",
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  segmentBtnActive: {
    backgroundColor: LaundryTheme.colors.primary,
    ...(LaundryTheme.shadow.soft as any),
  },
  segmentDivider: {
    width: 1,
    backgroundColor: "rgba(200, 190, 230, 0.5)",
    marginVertical: 10,
  },
  illustrationMiniWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  illustrationMiniWrapActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  illustrationMini: {
    width: 32,
    height: 32,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    textAlign: "center",
    lineHeight: 14,
  },
  segmentTextActive: { color: "#FFFFFF" },

  // Address lookup
  confirmedLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: LaundryTheme.colors.success,
  },
  addressInputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LaundryTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 6,
  },
  addressInputConfirmed: {
    borderColor: "rgba(35, 164, 105, 0.65)",
    backgroundColor: "rgba(35, 164, 105, 0.035)",
  },
  addressInputError: {
    borderColor: LaundryTheme.colors.danger,
    backgroundColor: "rgba(190, 55, 82, 0.035)",
  },
  addressInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: LaundryTheme.colors.ink,
    paddingVertical: 0,
  },
  suggestionsList: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    paddingVertical: 6,
    maxHeight: 200,
    zIndex: 99,
    elevation: 12,
    ...(LaundryTheme.shadow.strong as any),
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  suggestionLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  suggestionText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: LaundryTheme.colors.ink,
    flex: 1,
  },
  suggestionSecondary: {
    color: LaundryTheme.colors.muted,
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },
  googleAttribution: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LaundryTheme.colors.border,
    color: LaundryTheme.colors.muted,
    fontSize: 10.5,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 3,
    textAlign: "right",
  },
  addressEmpty: {
    color: LaundryTheme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  loadingText: {
    flex: 1,
    paddingHorizontal: 0,
  },
  addressError: {
    color: LaundryTheme.colors.danger,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 1,
  },

  // Pickup Time
  subHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  subHeaderLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 2,
  },
  pill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(230, 220, 250, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pillActive: {
    backgroundColor: LaundryTheme.colors.primary,
    borderColor: LaundryTheme.colors.primary,
    ...(LaundryTheme.shadow.soft as any),
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
    color: LaundryTheme.colors.ink,
  },
  pillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // Delivery Cards
  deliveryCard: {
    backgroundColor: "rgba(244, 238, 252, 0.5)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(230, 220, 250, 0.7)",
    padding: 14,
    marginBottom: 10,
  },
  expressCard: {
    backgroundColor: "rgba(76, 16, 125, 0.03)",
    borderColor: "rgba(76, 16, 125, 0.15)",
    marginBottom: 18,
  },
  deliveryCardSelected: {
    borderColor: LaundryTheme.colors.primary,
    borderWidth: 2,
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deliveryIcon: {
    fontSize: 20,
  },
  deliveryTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
  },
  deliverySubtext: {
    fontSize: 12,
    fontWeight: "600",
    color: LaundryTheme.colors.muted,
    marginTop: 3,
  },

  // Radio button
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: LaundryTheme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: LaundryTheme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LaundryTheme.colors.primary,
  },

  // CTA
  continueBtn: {
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...(LaundryTheme.shadow.strong as any),
  },
  continueBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
}) as any;
