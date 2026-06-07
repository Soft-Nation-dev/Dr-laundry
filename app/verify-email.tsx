import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { resendVerification, verifyEmail } from "@/lib/auth-api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (isSubmitting) {
      return;
    }

    if (!email.trim() || !code.trim()) {
      Alert.alert("Missing info", "Enter both email and code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyEmail({
        email: email.trim(),
        code: code.trim(),
      });

      if (!result.success) {
        Alert.alert("Verification failed", result.message);
        return;
      }

      Alert.alert("Email verified", result.message || "You can sign in now.");
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isResending) {
      return;
    }

    if (!email.trim()) {
      Alert.alert("Missing info", "Enter your email to resend code.");
      return;
    }

    setIsResending(true);
    try {
      const result = await resendVerification({ email: email.trim() });
      if (!result.success) {
        Alert.alert("Resend failed", result.message);
        return;
      }

      Alert.alert("Sent", result.message || "Verification code sent.");
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
            onPress={() => router.back()}
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
          <View style={styles.inputBlock}>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor="#9A8BB8"
              style={styles.input}
            />
          </View>

          <SoftPressable
            onPress={handleVerify}
            style={[
              styles.primaryButton,
              isSubmitting && styles.buttonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryText}>Verify email</Text>
            )}
          </SoftPressable>

          <SoftPressable
            onPress={handleResend}
            style={[styles.ghostButton, isResending && styles.buttonDisabled]}
          >
            {isResending ? (
              <ActivityIndicator
                color={LaundryTheme.colors.primaryDark}
                size="small"
              />
            ) : (
              <Text style={styles.ghostText}>Resend code</Text>
            )}
          </SoftPressable>
        </View>
      </SafeAreaView>
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
