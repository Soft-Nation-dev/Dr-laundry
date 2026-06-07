import { LaundryTheme } from "@/constants/laundry-theme";
import { getAccessToken } from "@/lib/auth-storage";
import { getAppMode } from "@/lib/app-mode";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export default function WelcomeScreen() {
  const rise = useRef(new Animated.Value(26)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const driftLeft = useRef(new Animated.Value(-14)).current;
  const driftRight = useRef(new Animated.Value(16)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(18)).current;
  const scaleIn = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    let isActive = true;

    Animated.parallel([
      Animated.timing(rise, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 950,
        useNativeDriver: true,
      }),
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 1050,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scaleIn, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
        bounciness: 7,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.06,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(driftLeft, {
            toValue: -6,
            duration: 2200,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(driftLeft, {
            toValue: -14,
            duration: 2200,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(driftRight, {
            toValue: 8,
            duration: 2400,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(driftRight, {
            toValue: 16,
            duration: 2400,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
      ),
    ]).start();

    const timer = setTimeout(() => {
      (async () => {
        const token = await getAccessToken();
        if (!isActive) {
          return;
        }

        const mode = await getAppMode();
        if (mode === "driver") {
          router.replace("/driver/home" as any);
        } else {
          router.replace(token ? "/home" : "/login");
        }
      })();
    }, 2400);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [driftLeft, driftRight, fade, pulse, rise, shimmer, scaleIn, slideUp]);

  return (
    <LinearGradient
      colors={[
        LaundryTheme.colors.bgStart,
        LaundryTheme.colors.primarySoft,
        LaundryTheme.colors.bgEnd,
      ]}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.blob,
          styles.blobLeft,
          { transform: [{ translateX: driftLeft }, { scale: pulse }] },
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          styles.blobRight,
          { transform: [{ translateX: driftRight }, { scale: pulse }] },
        ]}
      />
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fade,
            transform: [{ translateY: rise }, { scale: pulse }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: shimmer,
              transform: [{ scale: pulse }],
            },
          ]}
        >
          <View style={styles.dot} />
        </Animated.View>
        <Text style={styles.kicker}>Premium laundry, reimagined</Text>
        <Animated.Text
          style={[
            styles.brand,
            {
              opacity: fade,
              transform: [{ translateY: slideUp }, { scale: scaleIn }],
            },
          ]}
        >
          {LaundryTheme.brand.name}
        </Animated.Text>
        <Text style={styles.tagline}>{LaundryTheme.brand.promise}</Text>
        <View style={styles.featureRow}>
          <View style={styles.featurePill}>
            <Text style={styles.featureText}>Pickup in minutes</Text>
          </View>
          <View style={styles.featurePillSoft}>
            <Text style={styles.featureTextSoft}>Live rider tracking</Text>
          </View>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    opacity: 0.28,
  },
  blobLeft: {
    top: 72,
    left: -72,
    backgroundColor: "#B794F4",
  },
  blobRight: {
    bottom: 52,
    right: -68,
    backgroundColor: "#7C3AED",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFFF2",
    borderRadius: 32,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#6D28D9",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  ring: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  dot: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: LaundryTheme.colors.primary,
    shadowColor: "#6D28D9",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontSize: 11,
    fontWeight: "700",
    color: LaundryTheme.colors.primaryDark,
    marginBottom: 8,
  },
  brand: {
    fontSize: LaundryTheme.typography.display.fontSize,
    lineHeight: LaundryTheme.typography.display.lineHeight,
    fontWeight: LaundryTheme.typography.display.fontWeight,
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 10,
    textAlign: "center",
    color: LaundryTheme.colors.muted,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 260,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  featurePill: {
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  featurePillSoft: {
    backgroundColor: LaundryTheme.colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  featureText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  featureTextSoft: {
    color: LaundryTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
});
