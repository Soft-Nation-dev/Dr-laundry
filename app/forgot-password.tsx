import { AuthNotice, type AuthNoticeState } from "@/components/auth-notice";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { forgotPassword } from "@/lib/auth-api";
import {
  OperationTimeoutError,
  withTimeout,
} from "@/lib/promise-timeout";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [notice, setNotice] = useState<AuthNoticeState | null>(null);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!email.trim()) {
      setNotice({
        title: "Email needed",
        message: "Enter your email address to request a password reset link.",
        tone: "error",
      });
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setNotice({
        title: "Check your email",
        message: "Enter a valid email address.",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await withTimeout(
        forgotPassword({ email: email.trim().toLowerCase() }),
        30_000,
        "Password reset request timed out.",
      );

      if (!result.success) {
        setNotice({
          title: "Could not send the link",
          message: result.message,
          tone: "error",
        });
        return;
      }

      setRequestSent(true);
      setNotice({
        title: "Check your email",
        message: result.message,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        title:
          error instanceof OperationTimeoutError
            ? "Request timed out"
            : "Could not send the link",
        message:
          error instanceof OperationTimeoutError
            ? "The server took longer than 30 seconds. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Please try again.",
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
            onPress={() => router.back()}
            style={styles.roundButton}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={LaundryTheme.colors.ink}
            />
          </SoftPressable>
          <Text style={styles.title}>Forgot password</Text>
          <View style={styles.roundButton} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={requestSent ? "mail-open-outline" : "key-outline"}
              size={28}
              color={LaundryTheme.colors.primary}
            />
          </View>
          <Text style={styles.cardTitle}>
            {requestSent ? "Check your inbox" : "Recover your account"}
          </Text>
          <Text style={styles.cardCopy}>
            {requestSent
              ? "Open the secure link from Dr Laundry on this device. It will return you to the app to choose a new password."
              : "We’ll email you a secure link. For privacy, the response is the same whether or not an account exists."}
          </Text>
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

          <SoftPressable
            onPress={handleSubmit}
            style={[
              styles.primaryButton,
              isSubmitting && styles.buttonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryText}>
                {requestSent ? "Send another link" : "Send reset link"}
              </Text>
            )}
          </SoftPressable>
          {requestSent ? (
            <SoftPressable
              onPress={() => router.replace("/login")}
              style={styles.signInButton}
            >
              <Text style={styles.signInText}>Back to sign in</Text>
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
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  signInText: {
    color: LaundryTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
});
