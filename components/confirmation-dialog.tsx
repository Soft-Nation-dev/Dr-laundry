import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  icon = "navigate",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.icon}><Ionicons name={icon} size={27} color="#FFFFFF" /></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable disabled={busy} onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Not now</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={onConfirm} style={({ pressed }) => [styles.confirm, pressed && styles.pressed, busy && styles.disabled]}>
              <Text style={styles.confirmText}>{busy ? "Starting…" : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(8,3,16,0.76)" },
  card: { borderRadius: 28, padding: 22, backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.strong },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primary },
  title: { marginTop: 17, color: LaundryTheme.colors.ink, fontSize: 20, fontWeight: "900" },
  message: { marginTop: 9, color: LaundryTheme.colors.muted, fontSize: 13, lineHeight: 20 },
  actions: { marginTop: 22, flexDirection: "row", gap: 10 },
  cancel: { flex: 1, minHeight: 49, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F1EBF7" },
  confirm: { flex: 1.35, minHeight: 49, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primary },
  cancelText: { color: LaundryTheme.colors.ink, fontWeight: "800" },
  confirmText: { color: "#FFFFFF", fontWeight: "900" },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.58 },
});

