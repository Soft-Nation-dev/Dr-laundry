import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { login, register } from "@/lib/auth-api";
import { saveAuthSession } from "@/lib/auth-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LoginMode = "email" | "phone";
type AuthMode = "signIn" | "create";

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [mode, setMode] = useState<LoginMode>("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introOffset = useRef(new Animated.Value(18)).current;
  const cardScale = useRef(new Animated.Value(0.98)).current;

  const headline = useMemo(() => {
    if (authMode === "signIn") {
      const base = mode === "email" ? "Email" : "Phone";
      return `${base} sign in`;
    }
    return "Create account";
  }, [authMode, mode]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
      }),
      Animated.timing(introOffset, {
        toValue: 0,
        duration: LaundryTheme.motion.medium,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }),
    ]).start();
  }, [cardScale, introOffset, introOpacity]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (authMode === "signIn") {
      if (mode === "phone") {
        Alert.alert(
          "Not supported",
          "Phone sign in is not available yet. Please use email.",
        );
        return;
      }

      if (!email.trim() || !password) {
        Alert.alert("Missing info", "Enter your email and password.");
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await login({
          email: email.trim(),
          password,
        });

        if (!result.success || !result.data?.accessToken) {
          Alert.alert("Sign in failed", result.message);
          return;
        }

        await saveAuthSession({
          accessToken: result.data.accessToken,
          refreshToken: result.data.refreshToken,
          email: email.trim(),
        });

        router.replace("/home");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !password
    ) {
      Alert.alert("Missing info", "Fill in all the required fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please confirm your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({
        email: email.trim(),
        password,
        phoneNumber: phone.trim(),
        name: fullName.trim(),
        address: address.trim(),
      });

      if (!result.success) {
        Alert.alert("Sign up failed", result.message);
        return;
      }

      Alert.alert("Verify your email", result.message || "OTP sent.");
      router.replace({
        pathname: "/verify-email",
        params: { email: email.trim() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={[
        LaundryTheme.colors.bgStart,
        "#FFFFFF",
        LaundryTheme.colors.bgEnd,
      ]}
      style={styles.container}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[
          styles.safeArea,
          authMode === "create" && styles.safeAreaCreate,
        ]}
      >
        <Animated.View
          style={[
            styles.hero,
            { opacity: introOpacity, transform: [{ translateY: introOffset }] },
          ]}
        >
          <View style={styles.brandBadge}>
            <Ionicons
              name="water"
              size={14}
              color={LaundryTheme.colors.primaryDark}
            />
            <Text style={styles.brandBadgeText}>{LaundryTheme.brand.name}</Text>
          </View>
          <Text style={styles.kicker}>Welcome back</Text>
          <Text style={styles.heading}>{headline}</Text>
          {/* <Text style={styles.subHeading}>
            {authMode === "signIn"
              ? "Use either email or phone with your password to pick up right where you left off."
              : "Create your account with both email and phone so pickup, delivery, and tracking stay in sync."}
          </Text> */}
        </Animated.View>

        {authMode === "signIn" ? (
          <Animated.View
            style={[
              styles.switcher,
              { opacity: introOpacity, transform: [{ scale: cardScale }] },
            ]}
          >
            <SoftPressable
              onPress={() => setMode("email")}
              style={[
                styles.switchButton,
                mode === "email" && styles.switchButtonActive,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color={mode === "email" ? "#fff" : LaundryTheme.colors.muted}
              />
              <Text
                style={[
                  styles.switchText,
                  mode === "email" && styles.switchTextActive,
                ]}
              >
                Email
              </Text>
            </SoftPressable>
            <SoftPressable
              onPress={() => setMode("phone")}
              style={[
                styles.switchButton,
                mode === "phone" && styles.switchButtonActive,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={16}
                color={mode === "phone" ? "#fff" : LaundryTheme.colors.muted}
              />
              <Text
                style={[
                  styles.switchText,
                  mode === "phone" && styles.switchTextActive,
                ]}
              >
                Phone
              </Text>
            </SoftPressable>
          </Animated.View>
        ) : null}

        <Animated.View
          style={[
            styles.formCard,
            {
              opacity: introOpacity,
              transform: [{ translateY: introOffset }, { scale: cardScale }],
            },
          ]}
        >
          {authMode === "create" ? (
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Amina Yusuf"
                placeholderTextColor="#9A8BB8"
                style={styles.input}
              />
            </View>
          ) : null}

          {authMode === "create" ? (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  placeholderTextColor="#9A8BB8"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+234 000 000 0000"
                  placeholderTextColor="#9A8BB8"
                  style={styles.input}
                />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="12 Kudirat Abiola Way"
                  placeholderTextColor="#9A8BB8"
                  style={styles.input}
                />
              </View>
            </>
          ) : mode === "email" ? (
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="name@example.com"
                placeholderTextColor="#9A8BB8"
                style={styles.input}
              />
            </View>
          ) : (
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+234 000 000 0000"
                placeholderTextColor="#9A8BB8"
                style={styles.input}
              />
            </View>
          )}

          {authMode === "create" ? (
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Re-enter your password"
                placeholderTextColor="#9A8BB8"
                style={styles.input}
              />
            </View>
          ) : null}

          <View style={styles.inputBlock}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Enter your password"
              placeholderTextColor="#9A8BB8"
              style={styles.input}
            />
          </View>

          {authMode === "signIn" ? (
            <SoftPressable
              onPress={() => router.push("/forgot-password")}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </SoftPressable>
          ) : null}

          <SoftPressable
            onPress={handleSubmit}
            style={[styles.cta, isSubmitting && styles.ctaDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.ctaText}>
                {authMode === "signIn" ? "Continue" : "Create account"}
              </Text>
            )}
          </SoftPressable>

          <Text style={styles.tiny}>
            {authMode === "signIn"
              ? "Secure sign in to resume your journey with Dr Laundry."
              : "By creating an account, you can save addresses, repeat orders, and track every pickup."}
          </Text>

          <Animated.View
            style={[
              styles.segment,
              { opacity: introOpacity, transform: [{ scale: cardScale }] },
            ]}
          >
            <SoftPressable
              onPress={() => setAuthMode("signIn")}
              style={[
                styles.segmentButton,
                authMode === "signIn" && styles.segmentButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  authMode === "signIn" && styles.segmentTextActive,
                ]}
              >
                Sign in
              </Text>
            </SoftPressable>
            <SoftPressable
              onPress={() => setAuthMode("create")}
              style={[
                styles.segmentButton,
                authMode === "create" && styles.segmentButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  authMode === "create" && styles.segmentTextActive,
                ]}
              >
                Create account
              </Text>
            </SoftPressable>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
    justifyContent: "center",
  },
  safeAreaCreate: {
    paddingBottom: LaundryTheme.spacing.lg,
  },
  hero: {
    marginBottom: 18,
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    ...LaundryTheme.shadow.soft,
  },
  brandBadgeText: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
    fontSize: 12,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: 1.8,
    color: LaundryTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 10,
  },
  heading: {
    fontSize: LaundryTheme.typography.display.fontSize,
    lineHeight: LaundryTheme.typography.display.lineHeight,
    fontWeight: LaundryTheme.typography.display.fontWeight,
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.4,
  },
  subHeading: {
    marginTop: 10,
    maxWidth: 320,
    color: LaundryTheme.colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  segment: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    marginTop: 14,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: LaundryTheme.colors.primary,
  },
  segmentText: {
    color: LaundryTheme.colors.muted,
    fontWeight: "800",
    fontSize: 13,
  },
  segmentTextActive: {
    color: "#fff",
  },
  switcher: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    marginBottom: 16,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexDirection: "row",
  },
  switchButtonActive: {
    backgroundColor: LaundryTheme.colors.primary,
  },
  switchText: {
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
  },
  switchTextActive: {
    color: "#fff",
  },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    borderRadius: 28,
    padding: 18,
    shadowColor: "#6D28D9",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  inputBlock: {
    marginBottom: 14,
  },
  label: {
    color: LaundryTheme.colors.ink,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: LaundryTheme.colors.ink,
  },
  cta: {
    marginTop: 16,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 16,
    shadowColor: "#6D28D9",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  forgotButton: {
    alignSelf: "flex-end",
  },
  forgotText: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "700",
    fontSize: 12,
  },
  tiny: {
    marginTop: 14,
    textAlign: "center",
    color: LaundryTheme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
