import { AuthNotice, type AuthNoticeState } from "@/components/auth-notice";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { resetPassword } from "@/lib/auth-api";
import { clearPendingEmailVerification } from "@/lib/pending-email-verification";
import {
  clearPasswordRecoveryState,
  hasValidPasswordRecoveryState,
} from "@/lib/password-recovery-state";
import {
  OperationTimeoutError,
  withTimeout,
} from "@/lib/promise-timeout";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<AuthNoticeState | null>(null);

  useEffect(() => {
    let active = true;
    const validateRecovery = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const valid = session?.user?.id
        ? await hasValidPasswordRecoveryState(session.user.id)
        : false;
      if (!active) return;
      setCanReset(valid);
      setIsCheckingLink(false);
      if (!valid) {
        setNotice({
          title: "Reset link required",
          message:
            "Open the latest password reset link from your email. The link may have expired or already been used.",
          tone: "error",
        });
      }
    };
    void validateRecovery();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting || !canReset) return;

    if (newPassword.length < 8) {
      setNotice({
        title: "Password too short",
        message: "Use at least 8 characters for your new password.",
        tone: "error",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice({
        title: "Passwords do not match",
        message: "Re-enter the same new password in both fields.",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await withTimeout(
        resetPassword({ newPassword }),
        30_000,
        "Password update timed out.",
      );
      if (!result.success) {
        setNotice({
          title: "Password reset failed",
          message: result.message,
          tone: "error",
        });
        return;
      }

      await clearPasswordRecoveryState();
      await clearPendingEmailVerification();
      await supabase.auth.signOut();
      setNotice({
        title: "Password updated",
        message: "Your new password is ready. Sign in to continue.",
        tone: "success",
        onDismiss: () => router.replace("/login"),
      });
    } catch (error) {
      setNotice({
        title:
          error instanceof OperationTimeoutError
            ? "Reset timed out"
            : "Password reset failed",
        message:
          error instanceof OperationTimeoutError
            ? "The server took longer than 30 seconds. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Please request a new reset link and try again.",
        tone: "error",
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
          <Text style={styles.title}>Reset password</Text>
          <View style={styles.roundButton} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            {isCheckingLink ? (
              <ActivityIndicator color={LaundryTheme.colors.primary} />
            ) : (
              <Ionicons
                name={canReset ? "shield-checkmark-outline" : "link-outline"}
                size={29}
                color={LaundryTheme.colors.primary}
              />
            )}
          </View>
          <Text style={styles.cardTitle}>
            {canReset ? "Choose a new password" : "Secure link needed"}
          </Text>
          <Text style={styles.cardCopy}>
            {canReset
              ? "Use a password you do not use for another account."
              : "For your security, password changes only open from the latest recovery email."}
          </Text>

          {canReset ? (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.label}>New password</Text>
                <View style={styles.inputShell}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    placeholderTextColor="#9A8BB8"
                    style={styles.input}
                  />
                  <SoftPressable
                    onPress={() => setShowPassword((value) => !value)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={19}
                      color="#776B91"
                    />
                  </SoftPressable>
                </View>
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.label}>Confirm password</Text>
                <View style={styles.inputShell}>
                  <TextInput
                    key={showConfirmPassword ? "confirm-visible" : "confirm-hidden"}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    placeholderTextColor="#9A8BB8"
                    style={styles.input}
                  />
                  <SoftPressable
                    onPress={() => setShowConfirmPassword((value) => !value)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={19}
                      color="#776B91"
                    />
                  </SoftPressable>
                </View>
              </View>

              <SoftPressable
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
                style={[
                  styles.primaryButton,
                  isSubmitting && styles.buttonDisabled,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryText}>Update password</Text>
                )}
              </SoftPressable>
            </>
          ) : !isCheckingLink ? (
            <SoftPressable
              onPress={() => router.replace("/forgot-password")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>Request a new link</Text>
            </SoftPressable>
          ) : null}
        </View>
      </SafeAreaView>
      <AuthNotice notice={notice} onClose={() => setNotice(null)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
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
  title: { fontSize: 22, fontWeight: "800", color: LaundryTheme.colors.ink },
  card: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    padding: 18,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  cardTitle: {
    marginTop: 13,
    color: LaundryTheme.colors.ink,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  cardCopy: {
    color: LaundryTheme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
    marginBottom: 18,
  },
  inputBlock: { marginBottom: 14 },
  label: {
    color: LaundryTheme.colors.ink,
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "700",
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: LaundryTheme.colors.ink,
  },
  eyeButton: {
    width: 46,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 50,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
});
