import {
  AuthNotice,
  type AuthNoticeState,
} from "@/components/auth-notice";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { resendVerification } from "@/lib/auth-api";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VerifyEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const initialEmail = useMemo(() => {
    return typeof emailParam === "string" ? emailParam : "";
  }, [emailParam]);

  const [email, setEmail] = useState(initialEmail);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [notice, setNotice] = useState<AuthNoticeState | null>(null);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleResend = async () => {
    if (isResending || resendCountdown > 0) return;

    if (!email.trim()) {
      setNotice({
        title: "Missing email",
        message: "Enter your email to resend the confirmation link.",
        tone: "error",
      });
      return;
    }

    setIsResending(true);
    try {
      const result = await resendVerification({ email: email.trim() });
      if (!result.success) {
        setNotice({
          title: "Could not resend",
          message: result.message,
          tone: "error",
        });
        return;
      }

      setResendCountdown(60);
      setNotice({
        title: "Link sent",
        message:
          result.message ||
          "A new confirmation link is on its way to your inbox.",
        tone: "success",
      });
    } finally {
      setIsResending(false);
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
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <SoftPressable
            onPress={() => router.replace("/login")}
            style={styles.roundButton}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={LaundryTheme.colors.ink}
            />
          </SoftPressable>
          <Text style={styles.title}>Verify email</Text>
          <View style={styles.roundButton} />
        </View>

        <View style={styles.card}>
          <View style={styles.mailIcon}>
            <Image
              source={require("@/assets/images/logo.jpeg")}
              style={styles.logo}
              contentFit="cover"
            />
          </View>
          <Text style={styles.cardTitle}>Check your inbox</Text>
          <Text style={styles.cardCopy}>
            Tap the confirmation link in the email from Dr Laundry. It will
            bring you back to the app and sign you in securely.
          </Text>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>Email</Text>
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
          <SoftPressable
            onPress={handleResend}
            style={[
              styles.ghostButton,
              (isResending || resendCountdown > 0) && styles.buttonDisabled,
            ]}
          >
            {isResending ? (
              <ActivityIndicator
                color={LaundryTheme.colors.primaryDark}
                size="small"
              />
            ) : (
              <Text style={styles.ghostText}>
                {resendCountdown > 0
                  ? `Resend available in 0:${String(resendCountdown).padStart(2, "0")}`
                  : "Resend confirmation link"}
              </Text>
            )}
          </SoftPressable>
        </View>
      </SafeAreaView>
      <AuthNotice notice={notice} onClose={() => setNotice(null)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
  },
  card: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    padding: 18,
  },
  mailIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 22,
  },
  cardTitle: {
    marginTop: 14,
    textAlign: "center",
    color: LaundryTheme.colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  cardCopy: {
    marginTop: 8,
    marginBottom: 20,
    textAlign: "center",
    color: LaundryTheme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
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
  primaryButton: {
    marginTop: 4,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  ghostButton: {
    marginTop: 10,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E6EAF2",
  },
  ghostText: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
