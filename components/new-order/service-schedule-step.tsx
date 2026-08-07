import React from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  MODE_OPTIONS,
  PICKUP_DAY_OPTIONS,
  PICKUP_WINDOW_OPTIONS,
} from "@/constants/pricing";
import { LaundryMode, PickupDayCode, PickupWindowCode } from "@/types/order";

type Props = {
  mode: LaundryMode;
  setMode: (mode: LaundryMode) => void;
  address: string;
  setAddress: (addr: string) => void;
  addressValid: boolean;
  suggestionsVisible: boolean;
  setSuggestionsVisible: (visible: boolean) => void;
  filteredSuggestions: string[];
  selectAddress: (suggestion: string) => void;
  pickupDay: PickupDayCode;
  setPickupDay: (day: PickupDayCode) => void;
  pickupWindow: PickupWindowCode;
  setPickupWindow: (win: PickupWindowCode) => void;
  deliveryDay: PickupDayCode;
  setDeliveryDay: (day: PickupDayCode) => void;
  deliveryWindow: PickupWindowCode;
  setDeliveryWindow: (win: PickupWindowCode) => void;
  onNext: () => void;
};

export function ServiceScheduleStep({
  mode,
  setMode,
  address,
  setAddress,
  addressValid,
  suggestionsVisible,
  setSuggestionsVisible,
  filteredSuggestions,
  selectAddress,
  pickupDay,
  setPickupDay,
  pickupWindow,
  setPickupWindow,
  deliveryDay,
  setDeliveryDay,
  deliveryWindow,
  setDeliveryWindow,
  onNext,
}: Props) {
  const modeKeys = Object.keys(MODE_OPTIONS) as LaundryMode[];

  return (
    <View style={styles.container}>
      {/* 1. Service Mode Selection */}
      <Text style={styles.sectionTitle}>1. Choose Service Mode</Text>
      <View style={styles.modeRow}>
        {modeKeys.map((key) => {
          const option = MODE_OPTIONS[key];
          const active = mode === key;
          return (
            <SoftPressable
              key={key}
              onPress={() => setMode(key)}
              style={[styles.modeCard, active && styles.modeCardActive]}
            >
              <View style={[styles.modeIcon, active && styles.modeIconActive]}>
                <Ionicons
                  name={
                    key === "wash-iron"
                      ? "water"
                      : key === "ironing-only"
                      ? "flame"
                      : "water-outline"
                  }
                  size={22}
                  color={active ? "#fff" : LaundryTheme.colors.primaryDark}
                />
              </View>
              <Text
                style={[
                  styles.modeCardTitle,
                  active && styles.modeCardTitleActive,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.modeCardDetail,
                  active && styles.modeCardDetailActive,
                ]}
              >
                {option.detail}
              </Text>
              {active && (
                <View style={styles.modeCheck}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                </View>
              )}
            </SoftPressable>
          );
        })}
      </View>

      {/* 2. Pickup & Delivery Address */}
      <Text style={styles.sectionTitle}>2. Address & Location</Text>
      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Pickup & Delivery Address</Text>
        <View style={styles.addressInputRow}>
          <Ionicons
            name="location-outline"
            size={20}
            color={
              addressValid
                ? LaundryTheme.colors.success
                : LaundryTheme.colors.muted
            }
          />
          <TextInput
            style={styles.addressInput}
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setSuggestionsVisible(true);
            }}
            onFocus={() => setSuggestionsVisible(true)}
            placeholder="Type Lagos street address..."
            placeholderTextColor="#A090C0"
          />
          {addressValid && (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={LaundryTheme.colors.success}
            />
          )}
        </View>

        {/* Suggestions Dropdown */}
        {suggestionsVisible && filteredSuggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            {filteredSuggestions.map((suggestion) => (
              <SoftPressable
                key={suggestion}
                onPress={() => selectAddress(suggestion)}
                style={styles.suggestionItem}
              >
                <Ionicons
                  name="pin-outline"
                  size={14}
                  color={LaundryTheme.colors.primaryDark}
                />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </SoftPressable>
            ))}
          </View>
        )}
      </View>

      {/* 3. Pickup Schedule */}
      <Text style={styles.sectionTitle}>3. Pickup Schedule</Text>
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
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {day.label}
                </Text>
              </SoftPressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
          Pickup window
        </Text>
        <View style={styles.chipRow}>
          {PICKUP_WINDOW_OPTIONS.filter((w) => w.code !== "asap").map((window) => {
            const active = pickupWindow === window.code;
            return (
              <SoftPressable
                key={window.code}
                onPress={() => setPickupWindow(window.code)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {window.label}
                </Text>
              </SoftPressable>
            );
          })}
        </View>
      </View>

      {/* 4. Delivery Schedule */}
      <Text style={styles.sectionTitle}>4. Delivery Schedule</Text>
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
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {day.label}
                </Text>
              </SoftPressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
          Delivery window
        </Text>
        <View style={styles.chipRow}>
          {PICKUP_WINDOW_OPTIONS.filter((w) => w.code !== "asap").map((window) => {
            const active = deliveryWindow === window.code;
            return (
              <SoftPressable
                key={window.code}
                onPress={() => setDeliveryWindow(window.code)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {window.label}
                </Text>
              </SoftPressable>
            );
          })}
        </View>
      </View>

      {/* Continue Button */}
      <SoftPressable onPress={onNext} style={styles.nextBtn}>
        <Text style={styles.nextBtnText}>Continue to Select Items</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </SoftPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    marginTop: 10,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  modeCard: {
    flex: 1,
    ...LaundryTheme.glass,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    position: "relative",
  },
  modeCardActive: {
    backgroundColor: LaundryTheme.colors.primary,
    borderColor: LaundryTheme.colors.primaryDark,
  },
  modeIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  modeIconActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  modeCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    textAlign: "center",
  },
  modeCardTitleActive: { color: "#fff" },
  modeCardDetail: {
    fontSize: 13,
    color: LaundryTheme.colors.muted,
    textAlign: "center",
    marginTop: 4,
  },
  modeCardDetailActive: { color: "rgba(255,255,255,0.85)" },
  modeCheck: { position: "absolute", top: 6, right: 6 },

  fieldCard: {
    ...LaundryTheme.glass,
    borderRadius: 18,
    padding: 18,
    marginBottom: 10,
  },
  fieldLabel: {
    color: LaundryTheme.colors.muted,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  addressInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addressInput: {
    flex: 1,
    fontSize: 16,
    color: LaundryTheme.colors.ink,
    fontWeight: "600",
  },
  suggestionsList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: 6,
    gap: 6,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  suggestionText: {
    fontSize: 15,
    color: LaundryTheme.colors.ink,
    fontWeight: "600",
  },

  scheduleCard: {
    ...LaundryTheme.glass,
    borderRadius: 18,
    padding: 18,
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: LaundryTheme.colors.primary,
    backgroundColor: LaundryTheme.colors.primary,
  },
  chipText: {
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
    fontSize: 14,
  },
  chipTextActive: { color: "#fff" },

  nextBtn: {
    marginTop: 14,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...LaundryTheme.shadow.soft,
  },
  nextBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
