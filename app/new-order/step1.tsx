import StepHeader from "@/components/order/step-header";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { saveDraft } from "@/lib/order-draft";
import type { LaundryMode, PickupWindowCode } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MODES = [
  { key: "wash-iron", label: "Wash + Iron", sub: "Full care", icon: "sparkles-outline" },
  { key: "ironing-only", label: "Ironing Only", sub: "60% pricing", icon: "shirt-outline" },
  { key: "washing-only", label: "Washing Only", sub: "50% pricing", icon: "water-outline" },
];

export default function NewOrderStep1() {
  const router = useRouter();
  const [mode, setMode] = useState<LaundryMode>("wash-iron");
  const [pickupWindow, setPickupWindow] = useState<PickupWindowCode>("morning");

  const handleContinue = async () => {
    await saveDraft({ mode, pickupWindow });
    router.push("/new-order/step2");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <StepHeader title="Service & Pickup" subtitle="Fast setup" step={1} />

        {/* SERVICE MODE */}
        <Text style={styles.label}>Service mode</Text>
        <View style={styles.card}>
          {MODES.map((m, i) => (
            <SelectableRow
              key={m.key}
              label={m.label}
              sub={m.sub}
              icon={m.icon}
              selected={mode === m.key}
              onPress={() => setMode(m.key as LaundryMode)}
              isLast={i === MODES.length - 1}
            />
          ))}
        </View>

        {/* PICKUP */}
        <Text style={styles.label}>Pickup window</Text>
        <View style={styles.card}>
          <SelectableRow
            label="10am - 12pm"
            icon="sunny-outline"
            selected={pickupWindow === "morning"}
            onPress={() => setPickupWindow("morning")}
          />
          <SelectableRow
            label="3pm - 5pm"
            icon="partly-sunny-outline"
            selected={pickupWindow === "afternoon"}
            onPress={() => setPickupWindow("afternoon")}
            isLast
          />
        </View>

        {/* INFO */}
        <View style={styles.infoCard}>
          <Ionicons
            name="car-outline"
            size={16}
            color={LaundryTheme.colors.muted}
          />
          <Text style={styles.infoText}>
            Standard pickup + delivery fee: ₦1,500
          </Text>
        </View>
      </ScrollView>

      {/* CTA (RESPECTS YOUR TAB SPACE) */}
      <SoftPressable onPress={handleContinue} style={styles.cta}>
        <Text style={styles.ctaText}>Continue</Text>
      </SoftPressable>
    </SafeAreaView>
  );
}

/* ---------- ROW ---------- */

function SelectableRow({
  label,
  sub,
  icon,
  selected,
  onPress,
  isLast,
}: any) {
  return (
    <SoftPressable onPress={onPress} style={styles.row}>
      <View style={styles.left}>
        <Ionicons
          name={icon}
          size={18}
          color={LaundryTheme.colors.muted}
        />
        <View>
          <Text style={styles.rowTitle}>{label}</Text>
          {sub && <Text style={styles.rowSub}>{sub}</Text>}
        </View>
      </View>

      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={20}
        color={
          selected
            ? LaundryTheme.colors.primary
            : LaundryTheme.colors.muted
        }
      />

      {!isLast && <View style={styles.divider} />}
    </SoftPressable>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: LaundryTheme.colors.bgStart,
  },

  scrollContent: {
    paddingBottom: 16,
  },

  label: {
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6,
    color: LaundryTheme.colors.ink,
  },

  card: {
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
  },

  row: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowTitle: {
    fontSize: 14,
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
  },

  rowSub: {
    fontSize: 12,
    color: LaundryTheme.colors.muted,
    marginTop: 2,
    fontWeight: "600",
  },

  divider: {
    position: "absolute",
    left: 40,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: LaundryTheme.colors.border,
  },

  infoCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  infoText: {
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
  },

  cta: {
    marginTop: 10,
    marginBottom: LaundryTheme.layout.bottomMenuSpace - 20,
    backgroundColor: LaundryTheme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    ...LaundryTheme.shadow.soft,
  },

  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});