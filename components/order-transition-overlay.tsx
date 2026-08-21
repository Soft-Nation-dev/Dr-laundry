import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";

export const ORDER_TRANSITION_COVER_MS = 180;

type OrderTransitionOverlayProps = {
  visible: boolean;
  label?: string;
};

export function OrderTransitionOverlay({
  visible,
  label = "Preparing the next step…",
}: OrderTransitionOverlayProps) {
  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.985)).current;
  const cardOffset = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    backdropOpacity.stopAnimation();
    cardOpacity.stopAnimation();
    cardScale.stopAnimation();
    cardOffset.stopAnimation();

    if (visible) {
      mountedRef.current = true;
      setMounted(true);
      backdropOpacity.setValue(0);
      cardOpacity.setValue(0);
      cardScale.setValue(0.985);
      cardOffset.setValue(8);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: ORDER_TRANSITION_COVER_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cardScale, {
            toValue: 1,
            duration: 210,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cardOffset, {
            toValue: 0,
            duration: 210,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
      return;
    }

    if (!mountedRef.current) return;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 170,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 130,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.99,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        mountedRef.current = false;
        setMounted(false);
      }
    });
  }, [backdropOpacity, cardOffset, cardOpacity, cardScale, visible]);

  if (!mounted) return null;

  return (
    <Modal
      animationType="none"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={() => undefined}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Animated.View
          accessibilityLiveRegion="polite"
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardOffset }, { scale: cardScale }],
            },
          ]}
        >
          <LinearGradient colors={["#7C2BC2", "#50117D"]} style={styles.iconWrap}>
            <Ionicons name="shirt-outline" size={24} color="#FFFFFF" />
          </LinearGradient>
          <ActivityIndicator size="small" color={LaundryTheme.colors.primaryDark} />
          <View style={styles.copy}>
            <Text style={styles.title}>Just a moment</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    elevation: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#2B2331",
  },
  card: {
    width: "100%",
    maxWidth: 320,
    minHeight: 94,
    borderRadius: 24,
    paddingHorizontal: 17,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEE2F5",
    ...LaundryTheme.shadow.strong,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: LaundryTheme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  label: {
    marginTop: 3,
    color: LaundryTheme.colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
});
