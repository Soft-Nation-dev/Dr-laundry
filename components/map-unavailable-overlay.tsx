import { SoftPressable } from "@/components/soft-pressable";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type MapUnavailableOverlayProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  onOpenExternal?: () => void;
  dark?: boolean;
};

export function MapUnavailableOverlay({
  title = "Map temporarily unavailable",
  message,
  onRetry,
  onOpenExternal,
  dark = false,
}: MapUnavailableOverlayProps) {
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <View style={[styles.icon, dark && styles.iconDark]}>
        <Ionicons name="map-outline" size={25} color={dark ? "#D6B4FF" : "#7126BC"} />
      </View>
      <Text style={[styles.title, dark && styles.titleDark]}>{title}</Text>
      <Text style={[styles.message, dark && styles.messageDark]}>{message}</Text>
      <View style={styles.actions}>
        {onRetry ? (
          <SoftPressable onPress={onRetry} style={[styles.button, dark && styles.buttonDark]}>
            <Ionicons name="refresh" size={15} color="#FFFFFF" />
            <Text style={styles.buttonText}>Retry</Text>
          </SoftPressable>
        ) : null}
        {onOpenExternal ? (
          <SoftPressable onPress={onOpenExternal} style={[styles.secondaryButton, dark && styles.secondaryButtonDark]}>
            <Ionicons name="navigate-outline" size={15} color={dark ? "#E8D6F8" : "#58208A"} />
            <Text style={[styles.secondaryText, dark && styles.secondaryTextDark]}>Open Maps</Text>
          </SoftPressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#F3EEF8",
  },
  containerDark: { backgroundColor: "#171022" },
  icon: { width: 49, height: 49, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#E8DCF4" },
  iconDark: { backgroundColor: "rgba(184,135,240,0.13)" },
  title: { marginTop: 10, color: "#21152E", fontSize: 14, fontWeight: "900", textAlign: "center" },
  titleDark: { color: "#FFFFFF" },
  message: { marginTop: 4, color: "#786B84", fontSize: 10.5, lineHeight: 15, textAlign: "center" },
  messageDark: { color: "#AA96BB" },
  actions: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  button: { minHeight: 36, borderRadius: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#7126BC" },
  buttonDark: { backgroundColor: "#7C2BC2" },
  buttonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  secondaryButton: { minHeight: 36, borderRadius: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#E8DCF4" },
  secondaryButtonDark: { backgroundColor: "rgba(255,255,255,0.09)" },
  secondaryText: { color: "#58208A", fontSize: 10, fontWeight: "900" },
  secondaryTextDark: { color: "#E8D6F8" },
});
