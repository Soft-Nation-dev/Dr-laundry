import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export type AuthNoticeState = {
  title: string;
  message: string;
  tone?: "error" | "success" | "info";
  onDismiss?: () => void;
};

type AuthNoticeProps = {
  notice: AuthNoticeState | null;
  onClose: () => void;
};

const noticeVisuals = {
  error: {
    icon: "alert-circle" as const,
    color: "#C2415D",
    background: "#FFF0F3",
  },
  success: {
    icon: "checkmark-circle" as const,
    color: "#16866A",
    background: "#EAFBF5",
  },
  info: {
    icon: "information-circle" as const,
    color: LaundryTheme.colors.primary,
    background: LaundryTheme.colors.primarySoft,
  },
};

export function AuthNotice({ notice, onClose }: AuthNoticeProps) {
  const tone = notice?.tone ?? "info";
  const visual = noticeVisuals[tone];

  const dismiss = () => {
    const afterDismiss = notice?.onDismiss;
    onClose();
    afterDismiss?.();
  };

  return (
    <Modal
      transparent
      visible={Boolean(notice)}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <View style={styles.card}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: visual.background },
            ]}
          >
            <Ionicons name={visual.icon} size={29} color={visual.color} />
          </View>
          <Text style={styles.title}>{notice?.title}</Text>
          <Text style={styles.message}>{notice?.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={dismiss}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: visual.color },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Okay</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(23, 15, 38, 0.52)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 26,
    padding: 22,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#1F102F",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 15,
    color: LaundryTheme.colors.ink,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    color: LaundryTheme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    alignSelf: "stretch",
    marginTop: 20,
    minHeight: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.86 },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
