import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import {
  EXPRESS_DELIVERY_FEE,
  EXPRESS_SURCHARGE_RATE,
} from "@/constants/pricing";
import { formatNaira } from "@/lib/pricing";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export default function MembershipScreen() {
  const sampleStandard = 10000;
  const sampleExpress =
    sampleStandard +
    sampleStandard * EXPRESS_SURCHARGE_RATE +
    EXPRESS_DELIVERY_FEE;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <SoftPressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#111" />
          </SoftPressable>
          <Text style={styles.title}>Express</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.hero}>
          <Ionicons name="flash" size={36} color="#fff" />
          <Text style={styles.heroTitle}>Priority pickup</Text>
          <Text style={styles.heroSub}>Immediate pickup • 48h return</Text>
        </View>

        <View style={styles.featureCard}>
          <Feature icon="time-outline" text="Immediate pickup scheduling" />
          <Feature icon="rocket-outline" text="Returned within 48 hours" />
          <Feature icon="star-outline" text="Priority handling" />
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceTitle}>Express pricing</Text>
          <Text style={styles.priceLine}>
            Surcharge: {Math.round(EXPRESS_SURCHARGE_RATE * 100)}% of standard
            total
          </Text>
          <Text style={styles.priceLine}>
            Express delivery: {formatNaira(EXPRESS_DELIVERY_FEE)}
          </Text>
          <Text style={styles.priceFormula}>
            Express total = Standard total + surcharge + delivery
          </Text>
          <Text style={styles.sample}>
            Example: {formatNaira(sampleStandard)} becomes{" "}
            {formatNaira(sampleExpress)}
          </Text>
        </View>

        <Text style={styles.short}>
          Enable Express during payment whenever you need speed.
        </Text>
      </ScrollView>

      <SoftPressable
        onPress={() => router.push("/new-order")}
        style={styles.button}
      >
        <Text style={styles.buttonText}>View price list / Start order</Text>
      </SoftPressable>
    </SafeAreaView>
  );
}

function Feature({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon} size={17} color={LaundryTheme.colors.primaryDark} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: LaundryTheme.colors.bgStart,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "800" },
  hero: {
    marginTop: 22,
    backgroundColor: LaundryTheme.colors.primary,
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 8 },
  heroSub: { color: "#E8F1FF", marginTop: 6 },
  featureCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
  },
  priceCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
    padding: 12,
  },
  priceTitle: {
    color: LaundryTheme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  priceLine: {
    marginTop: 6,
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
  },
  priceFormula: {
    marginTop: 8,
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
  },
  sample: {
    marginTop: 6,
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
  },
  short: {
    marginTop: 12,
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
  },
  button: {
    marginTop: 10,
    marginBottom: LaundryTheme.layout.bottomMenuSpace - 20,
    backgroundColor: LaundryTheme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    ...LaundryTheme.shadow.soft,
  },
  buttonText: { color: "#fff", fontWeight: "800" },
});
