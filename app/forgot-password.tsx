import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { forgotPassword } from "@/lib/auth-api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!email.trim()) {
      Alert.alert("Missing info", "Enter your email to reset password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await forgotPassword({ email: email.trim() });

      if (!result.success) {
        Alert.alert("Request failed", result.message);
        return;
      }

      Alert.alert("Check your email", result.message || "OTP sent.");
      router.replace({
        pathname: "/reset-password",
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
              <Text style={styles.primaryText}>Send reset code</Text>
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
  buttonDisabled: {
    opacity: 0.6,
  },
});
