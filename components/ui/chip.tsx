import { LaundryTheme } from "@/constants/laundry-theme";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export default function Chip({ label, active, onPress, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.active : styles.inactive, style]}
    >
      <Text
        style={[styles.text, active ? styles.textActive : styles.textInactive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  active: { backgroundColor: LaundryTheme.colors.primary },
  inactive: { backgroundColor: "#F3F6FA" },
  text: { fontWeight: "700" },
  textActive: { color: "#fff" },
  textInactive: { color: "#222" },
});
