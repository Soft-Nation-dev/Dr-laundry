import {
  AuthNotice,
  type AuthNoticeState,
} from "@/components/auth-notice";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { resendVerification, syncCurrentUserProfile } from "@/lib/auth-api";
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
  savePendingEmailVerification,
} from "@/lib/pending-email-verification";
import { getProfile } from "@/lib/profile-api";
import {
  OperationTimeoutError,
  withTimeout,
} from "@/lib/promise-timeout";
import { getLandingRoute } from "@/lib/role-routing";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const VERIFICATION_REQUEST_TIMEOUT_MS = 30_000;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const {
    email: emailParam,
    autoResend,
    message: messageParam,
    status,
  } = useLocalSearchParams<{
    email?: string;
    autoResend?: string;
    message?: string;
    status?: "registered" | "resent" | "resend-failed" | "unverified";
  }>();
  const initialEmail = useMemo(() => {
    return typeof emailParam === "string" ? emailParam : "";
  }, [emailParam]);

  const [email, setEmail] = useState(initialEmail);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(
    RESEND_COOLDOWN_SECONDS,
  );
  const [notice, setNotice] = useState<AuthNoticeState | null>(null);
  const isCompletingAuth = useRef(false);
  const attemptedAutomaticResend = useRef(false);

  useEffect(() => {
    if (!status) return;

    setNotice({
      title:
        status === "registered"
          ? "Check your email"
          : status === "resent"
            ? "Verification link sent"
            : status === "unverified"
              ? "Verify your email"
              : "Email verification needed",
      message:
        messageParam ||
        (status === "resend-failed"
          ? "Your email is not verified yet. Use resend below to request a new link."
          : status === "unverified"
            ? "Your account is waiting for email verification. We’re sending a fresh confirmation link now."
            : "Open the confirmation link we sent to your inbox."),
      tone: status === "resend-failed" ? "error" : "success",
    });
  }, [messageParam, status]);

  useEffect(() => {
    let active = true;

    const restorePendingEmail = async () => {
      const pending = await getPendingEmailVerification();
      if (active && !initialEmail && pending?.email) {
        setEmail(pending.email);
      }
    };

    const finishIfAuthenticated = async () => {
      if (isCompletingAuth.current) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active || !session) return;

      isCompletingAuth.current = true;
      try {
        const landingRoute = await withTimeout(
          (async () => {
            await clearPendingEmailVerification();
            await syncCurrentUserProfile();
            const profile = await getProfile();
            return getLandingRoute(profile.data?.role ?? "customer");
          })(),
          VERIFICATION_REQUEST_TIMEOUT_MS,
          "Finishing verification timed out.",
        );

        if (active) router.replace(landingRoute as never);
      } catch (error) {
        isCompletingAuth.current = false;
        if (active) {
          setNotice({
            title: "Could not finish signing in",
            message:
              error instanceof OperationTimeoutError
                ? "Finishing sign in took longer than 30 seconds. Check your connection and try opening the app again."
                : error instanceof Error
                  ? error.message
                  : "Please check your connection and try again.",
            tone: "error",
          });
        }
      }
    };

    void restorePendingEmail();
    void finishIfAuthenticated();

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void finishIfAuthenticated();
        }
      },
    );

    return () => {
      active = false;
      appStateSubscription.remove();
    };
  }, [initialEmail]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const sendVerificationLink = useCallback(
    async (automatic = false) => {
      if (isResending || (!automatic && resendCountdown > 0)) return;

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
        const result = await withTimeout(
          resendVerification({ email: email.trim() }),
          VERIFICATION_REQUEST_TIMEOUT_MS,
          "Verification resend timed out.",
        );
        if (!result.success) {
          setNotice({
            title: "Could not resend",
            message: result.message,
            tone: "error",
          });
          return;
        }

        await savePendingEmailVerification(email);
        setResendCountdown(RESEND_COOLDOWN_SECONDS);
        setNotice({
          title: "Link sent",
          message:
            result.message ||
            "A new confirmation link is on its way to your inbox.",
          tone: "success",
        });
      } catch (error) {
        setNotice({
          title:
            error instanceof OperationTimeoutError
              ? "Request timed out"
              : "Could not resend",
          message:
            error instanceof OperationTimeoutError
              ? "Sending the link took longer than 30 seconds. Check your connection and try again when resend becomes available."
              : error instanceof Error
                ? error.message
                : "We could not send the confirmation link. Please try again.",
          tone: "error",
        });
      } finally {
        setIsResending(false);
      }
    },
    [email, isResending, resendCountdown],
  );

  useEffect(() => {
    if (
      autoResend !== "true" ||
      attemptedAutomaticResend.current ||
      !email.trim()
    ) {
      return;
    }

    attemptedAutomaticResend.current = true;
    void sendVerificationLink(true);
  }, [autoResend, email, sendVerificationLink]);

  const handleResend = () => {
    void sendVerificationLink(false);
  };

  const handleUseAnotherEmail = async () => {
    await clearPendingEmailVerification();
    router.replace("/login");
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
            onPress={handleUseAnotherEmail}
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
              onEndEditing={() => void savePendingEmailVerification(email)}
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
          <SoftPressable
            onPress={handleUseAnotherEmail}
            style={styles.useAnotherButton}
          >
            <Text style={styles.useAnotherText}>Use a different email</Text>
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
  useAnotherButton: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 2,
  },
  useAnotherText: {
    color: LaundryTheme.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
