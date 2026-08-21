import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type AppToastMessage = {
  id: number;
  title: string;
  message: string;
  tone?: "error" | "info" | "success";
  actionLabel?: string;
  dismissLabel?: string;
  persistent?: boolean;
  onAction?: () => void;
};

type Props = {
  toast: AppToastMessage | null;
  topInset?: number;
  onDismiss: () => void;
};

export function AppToast({ toast, topInset = 12, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-18)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    translateY.setValue(-18);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    if (toast.persistent) return;

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 150, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) onDismiss(); });
    }, 3600);
    return () => clearTimeout(timer);
  }, [onDismiss, opacity, toast, translateY]);

  if (!toast) return null;
  const tone = toast.tone ?? "error";
  const icon = tone === "success" ? "checkmark-circle" : tone === "info" ? "information-circle" : "alert-circle";
  const color = tone === "success" ? LaundryTheme.colors.success : tone === "info" ? LaundryTheme.colors.primary : LaundryTheme.colors.danger;

  return (
    <Animated.View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[styles.wrap, { top: Math.max(topInset, insets.top + 8), opacity, transform: [{ translateY }] }]}
    >
      <View style={[styles.icon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{toast.title}</Text>
        <Text style={styles.message}>{toast.message}</Text>
        {toast.actionLabel && toast.onAction ? (
          <View style={styles.actions}>
            {toast.dismissLabel ? (
              <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismissButton}>
                <Text style={styles.dismissText}>{toast.dismissLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={toast.onAction} style={styles.actionButton}>
              <Text style={styles.actionText}>{toast.actionLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 5000,
    minHeight: 76,
    padding: 13,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EADFF1",
    ...LaundryTheme.shadow.strong,
    elevation: 40,
  },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  title: { color: LaundryTheme.colors.ink, fontSize: 13.5, fontWeight: "900" },
  message: { marginTop: 2, color: LaundryTheme.colors.muted, fontSize: 11.5, lineHeight: 16.5, fontWeight: "600" },
  actions: { marginTop: 11, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  dismissButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 10, borderRadius: 11 },
  dismissText: { color: LaundryTheme.colors.muted, fontSize: 11, fontWeight: "800" },
  actionButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 13, borderRadius: 11, backgroundColor: LaundryTheme.colors.primary },
  actionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
