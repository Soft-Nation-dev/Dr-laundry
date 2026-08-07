import React from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { MODE_OPTIONS } from "@/constants/pricing";
import {
  getPickupDayLabel,
  getPickupWindowLabel,
  getDeliveryDayLabel,
  getDeliveryWindowLabel,
  formatNaira,
} from "@/lib/pricing";
import { OrderDraft, OrderLineItem } from "@/types/order";

type Props = {
  draft: OrderDraft;
  note: string;
  setNote: (note: string) => void;
  onBack: () => void;
  onProceed: () => void;
};

export function OrderReviewStep({
  draft,
  note,
  setNote,
  onBack,
  onProceed,
}: Props) {
  const totalItemsCount = draft.lineItems.reduce(
    (sum: number, item: OrderLineItem) => sum + item.quantity,
    0,
  );

  return (
    <View style={styles.container}>
      {/* 1. Order Summary Header Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Service Mode</Text>
          <Text style={styles.value}>{MODE_OPTIONS[draft.mode].label}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Pickup Address</Text>
          <Text style={styles.value} numberOfLines={2}>
            {draft.address || "No address selected"}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Pickup Slot</Text>
          <Text style={styles.value}>
            {getPickupDayLabel(draft.pickupDay)} •{" "}
            {getPickupWindowLabel(draft.pickupWindow)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.label}>Delivery Slot</Text>
          <Text style={styles.value}>
            {draft.deliveryDay && draft.deliveryWindow
              ? `${getDeliveryDayLabel(draft.deliveryDay)} • ${getDeliveryWindowLabel(
                  draft.deliveryWindow,
                )}`
              : "Standard delivery schedule"}
          </Text>
        </View>
      </View>

      {/* 2. Items Breakdown Card */}
      <View style={styles.card}>
        <View style={styles.itemsHeaderRow}>
          <Text style={styles.cardTitle}>Selected Garments</Text>
          <Text style={styles.badge}>{totalItemsCount} pieces</Text>
        </View>

        {draft.lineItems.map((item: OrderLineItem) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemMeta}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSubText}>
                {item.quantity} x {formatNaira(item.unitPrice)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {formatNaira(item.unitPrice * item.quantity)}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Base Subtotal</Text>
          <Text style={styles.priceVal}>
            {formatNaira(draft.totals.baseSubtotal)}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>
            {MODE_OPTIONS[draft.mode].label} Service
          </Text>
          <Text style={styles.priceVal}>
            {formatNaira(draft.totals.modeSubtotal)}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Pickup & Delivery Fee</Text>
          <Text style={styles.priceVal}>
            {formatNaira(draft.totals.pickupDeliveryFee)}
          </Text>
        </View>

        <View style={[styles.priceRow, { marginTop: 6 }]}>
          <Text style={styles.totalLabel}>Estimated Standard Total</Text>
          <Text style={styles.totalVal}>
            {formatNaira(draft.totals.standardTotal)}
          </Text>
        </View>
      </View>

      {/* 3. Special Notes / Instructions Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Special Instructions (Optional)</Text>
        <TextInput
          style={styles.noteInput}
          multiline
          numberOfLines={3}
          placeholder="e.g. Delicate silk shirt, extra starch on trousers..."
          placeholderTextColor="#A090C0"
          value={note}
          onChangeText={setNote}
        />
      </View>

      {/* 4. Action Buttons */}
      <View style={styles.navRow}>
        <SoftPressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={LaundryTheme.colors.ink} />
          <Text style={styles.backBtnText}>Edit Items</Text>
        </SoftPressable>

        <SoftPressable onPress={onProceed} style={styles.proceedBtn}>
          <Text style={styles.proceedText}>Proceed to Payment</Text>
          <Ionicons name="card-outline" size={18} color="#fff" />
        </SoftPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  card: {
    ...LaundryTheme.glass,
    borderRadius: 18,
    padding: 18,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    marginBottom: 10,
    paddingVertical: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: { fontSize: 14, color: LaundryTheme.colors.muted, fontWeight: "600", flexShrink: 0, paddingVertical: 4, paddingHorizontal: 2 },
  value: {
    fontSize: 15,
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
    flex: 1,
    marginLeft: 16,
    textAlign: "right",
    paddingVertical: 2,
  },

  itemsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  badge: {
    fontSize: 12,
    fontWeight: "800",
    color: LaundryTheme.colors.primaryDark,
    backgroundColor: LaundryTheme.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  itemMeta: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 15, fontWeight: "700", color: LaundryTheme.colors.ink, paddingVertical: 2 },
  itemSubText: {
    fontSize: 13,
    color: LaundryTheme.colors.muted,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    flexShrink: 0,
    lineHeight: 20,
    paddingVertical: 2,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginVertical: 10,
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 14,
    color: LaundryTheme.colors.muted,
    fontWeight: "600",
    flexShrink: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  priceVal: {
    fontSize: 14,
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
    flexShrink: 0,
    marginLeft: 8,
    lineHeight: 20,
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 17,
    color: LaundryTheme.colors.ink,
    fontWeight: "800",
    flexShrink: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  totalVal: {
    fontSize: 22,
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "900",
    flexShrink: 0,
    marginLeft: 8,
    lineHeight: 28,
    paddingVertical: 2,
  },

  noteInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    padding: 12,
    fontSize: 15,
    color: LaundryTheme.colors.ink,
    textAlignVertical: "top",
    minHeight: 70,
  },

  navRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  backBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
  },
  backBtnText: { fontWeight: "800", color: LaundryTheme.colors.ink },
  proceedBtn: {
    flex: 2,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: LaundryTheme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...LaundryTheme.shadow.soft,
  },
  proceedText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
