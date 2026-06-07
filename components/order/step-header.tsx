import { LaundryTheme } from "@/constants/laundry-theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = { title: string; subtitle?: string; step?: number };

export default function StepHeader({ title, subtitle, step }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {typeof step === "number" && (
          <Text style={styles.step}>Step {step}</Text>
        )}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "800", color: LaundryTheme.colors.ink },
  step: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    backgroundColor: LaundryTheme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  subtitle: {
    color: LaundryTheme.colors.muted,
    marginTop: 6,
    fontWeight: "700",
  },
});
